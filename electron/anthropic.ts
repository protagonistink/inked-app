import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { store } from './store';
import type { BriefingContext, ChatMessage, InkContext, InkMode, UserPhysics } from '../src/types';
import { INK_TOKEN_LIMITS } from '../src/lib/ink-mode';
import { getEngineState } from './finance';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Default model — update here or override via store key 'anthropic.model'
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const AI_DEBUG = process.env.DEBUG_INKED_AI === '1';

// Max conversation turns to send per request (prevents token bloat in long sessions)
const MAX_HISTORY_TURNS = 12;

function logAI(message: string, ...args: unknown[]) {
  if (!AI_DEBUG) return;
  console.log(message, ...args);
}

function loadInkContext(): InkContext | null {
  const raw = store.get('inkContext') as InkContext | undefined;
  if (!raw || typeof raw !== 'object') return null;
  return raw;
}

function formatInkContextForPrompt(ink: InkContext): string {
  const sections: string[] = [];

  // Weekly interview context (Sprint 4 will populate these)
  if (ink.weeklyContext) sections.push(`Weekly context: ${ink.weeklyContext}`);
  if (ink.hierarchy) sections.push(`Priority hierarchy: ${ink.hierarchy}`);
  if (ink.musts) sections.push(`This week's musts: ${ink.musts}`);
  if (ink.currentPriority) sections.push(`Current priority: ${ink.currentPriority}`);
  if (ink.protectedBlocks) sections.push(`Protected blocks: ${ink.protectedBlocks}`);
  if (ink.tells) sections.push(`Working pattern tells: ${ink.tells}`);
  if (ink.honestAudit) sections.push(`Honest audit: ${ink.honestAudit}`);

  // Journal entries (rolling 7-day window)
  if (ink.journalEntries?.length > 0) {
    const journalLines = ink.journalEntries.map((entry) => {
      const movers = entry.needleMovers
        ?.map((m) => `${m.goalTitle}: ${m.action}`)
        .join('; ') || '';
      return `${entry.date}: excites="${entry.excites}", needle-movers=[${movers}], artist-date="${entry.artistDate}"${entry.eveningReflection ? `, reflection="${entry.eveningReflection}"` : ''}`;
    });
    sections.push(`### Recent Journal (last 7 days)\n${journalLines.join('\n')}`);
  }

  return sections.length > 0
    ? `## INK MEMORY\n\n${sections.join('\n')}\n\n---\n`
    : '';
}

function buildInterviewPrompt(ctx: BriefingContext): string {
  const physics = ctx.userPhysics ?? loadUserPhysics();
  const inkContext = loadInkContext();

  const goalsList = ctx.weeklyGoals
    .map(g => `- ${g.title}${g.why ? ` (why: ${g.why})` : ''}`)
    .join('\n') || 'No goals set yet.';

  // Journal entries for the past week
  let journalSection = 'No journal entries this week.';
  if (inkContext?.journalEntries?.length) {
    const lines = inkContext.journalEntries.map((e) => {
      const movers = e.needleMovers
        ?.map((m) => `${m.goalTitle}: ${m.action}`)
        .join('; ') || '';
      return `${e.date}: excites="${e.excites}", needle-movers=[${movers}], artist-date="${e.artistDate}"${e.eveningReflection ? `, reflection="${e.eveningReflection}"` : ''}`;
    });
    journalSection = lines.join('\n');
  }

  // Previous week's context for continuity
  const prevLines = inkContext ? [
    inkContext.hierarchy && `Previous hierarchy: ${inkContext.hierarchy}`,
    inkContext.musts && `Previous musts: ${inkContext.musts}`,
    inkContext.currentPriority && `Previous priority: ${inkContext.currentPriority}`,
    inkContext.honestAudit && `Previous honest audit: ${inkContext.honestAudit}`,
  ].filter(Boolean) : [];
  const prevSection = prevLines.length > 0
    ? `## LAST WEEK'S CONTEXT\n${prevLines.join('\n')}\n`
    : '';

  const monthlySection = ctx.monthlyOneThing
    ? `\n## MONTHLY FOCUS\n${ctx.monthlyOneThing}${ctx.monthlyWhy ? ` — Why: ${ctx.monthlyWhy}` : ''}\n`
    : '';

  return `You are conducting Patrick Kirkland's weekly planning interview. You are Ink — sharp, direct, warm but not soft. Today is ${ctx.date}.

## WHO YOU'RE TALKING TO

Patrick Kirkland — narrative strategist, screenwriter, founder of Protagonist Ink.
- Ideal focus block: ${physics.focusBlockLength} min
- Peak energy: ${physics.peakEnergyWindow}
- Common derailers: ${physics.commonDerailers.join(', ')}
- Planning style: ${physics.planningStyle}
- Recovery pattern: ${physics.recoveryPattern}
- Watch for: ${physics.warningSignals.join('; ')}
${monthlySection}
## PATRICK'S CURRENT WEEKLY GOALS
${goalsList}

## LAST WEEK'S JOURNAL
${journalSection}

${prevSection}## YOUR JOB

Conduct a 7-question weekly interview, one question at a time. Wait for Patrick's answer before asking the next. If an answer is vague or hedging, push back once — be specific about what's missing — then accept and move on.

The 7 questions, in order:

1. "What's the shape of this week? What's locked, what's in play, what's on fire?"
   → Captures: weeklyContext

2. "Rank your goals. If you could only move one forward this week, which one? Then the next."
   → Captures: hierarchy

3. "What must happen this week — non-negotiable, can't-slip?"
   → Captures: musts

4. "One thing. If the week goes sideways and you can only protect one outcome, what is it?"
   → Captures: currentPriority

5. "What time is sacred this week? What blocks do I protect no matter what comes in?"
   → Captures: protectedBlocks

6. "Any patterns you've noticed in how you've been working lately? Anything worth naming — good or bad."
   → Captures: tells

7. "What are you avoiding? What keeps getting pushed to next week?"
   → Captures: honestAudit

## AFTER ALL 7 ANSWERS

Synthesize Patrick's answers into a structured context block. Output it as a fenced JSON code block with exactly these keys:

\`\`\`json
{
  "weeklyContext": "...",
  "hierarchy": "...",
  "musts": "...",
  "currentPriority": "...",
  "protectedBlocks": "...",
  "tells": "...",
  "honestAudit": "..."
}
\`\`\`

Values should be concise summaries (1-2 sentences each), not raw quotes. Capture the signal, drop the filler.

## RESPONSE FORMAT
- One question per turn. Short setup (1-2 sentences max) then the question.
- If pushing back, be specific about what's vague. One pushback max per question.
- Max 60 words per question turn. Max 120 words for the synthesis turn.
- After the final answer, output the JSON block. No closing summary.
- No preamble ("Great!", "Sure,", "Got it"). Lead with substance.`;
}

export function buildSystemPrompt(ctx: BriefingContext): string {
  if (ctx.inkMode === 'sunday-interview') {
    return buildInterviewPrompt(ctx);
  }

  const goalsList = ctx.weeklyGoals
    .map(g => `- ${g.title}${g.why ? ` (why: ${g.why})` : ''}`)
    .join('\n');

  const gcalList = ctx.gcalEvents.length > 0
    ? ctx.gcalEvents.map(e => {
        if (e.isAllDay) return `- All day: ${e.title}`;
        return `- ${e.startTime}–${e.endTime}: ${e.title}`;
      }).join('\n')
    : 'No calendar events today.';

  const alreadyCommitted = ctx.committedTasks.length > 0
    ? ctx.committedTasks.map(t => `- ${t.title} (${t.estimateMins}m, ${t.weeklyGoal})`).join('\n')
    : 'Nothing committed yet.';

  const today = new Date();

  const capacityHours = (ctx.availableFocusMinutes / 60).toFixed(1);
  const scheduledHours = (ctx.scheduledMinutes / 60).toFixed(1);
  const remainingHours = (Math.max(0, ctx.availableFocusMinutes - ctx.scheduledMinutes) / 60).toFixed(1);
  const startTime = `${ctx.workdayStartHour}:${String(ctx.workdayStartMin).padStart(2, '0')}`;
  const endTime = `${ctx.workdayEndHour}:${String(ctx.workdayEndMin).padStart(2, '0')}`;
  const pastCloseHours = Math.floor(ctx.minutesPastClose / 60);
  const pastCloseMinutes = ctx.minutesPastClose % 60;
  const afterHoursLabel = ctx.minutesPastClose === 0
    ? '0m past close'
    : pastCloseHours > 0
      ? `${pastCloseHours}h ${pastCloseMinutes}m past close`
      : `${pastCloseMinutes}m past close`;

  // Rebuild Asana list with urgency markers for the prompt
  const asanaListDetailed = ctx.asanaTasks.length > 0
    ? ctx.asanaTasks.map(t => {
        const dueDate = t.dueOn ? new Date(t.dueOn) : null;
        const dueToday = dueDate && dueDate.toDateString() === today.toDateString();
        const overdue = dueDate && dueDate < today && !dueToday;
        const dueLabel = dueToday
          ? '⚑ DUE TODAY'
          : overdue
          ? `⚑ OVERDUE (was ${t.dueOn})`
          : t.dueOn
          ? `due ${t.dueOn}`
          : 'no due date';
        const priority = t.priority ? ` [${t.priority}]` : '';
        const project = t.project ? ` — ${t.project}` : '';
        const stale = t.daysSinceAdded != null && t.daysSinceAdded > 7
          ? ` (in list ${t.daysSinceAdded}d — stale?)`
          : '';
        const tags = t.tags?.length ? ` #${t.tags.join(' #')}` : '';
        const notes = t.notes?.trim()
          ? `\n  → ${t.notes.slice(0, 100)}${t.notes.length > 100 ? '…' : ''}`
          : '';
        return `- ${t.title}${priority}${project}${tags} | ${dueLabel}${stale}${notes}`;
      }).join('\n')
    : 'No Asana tasks found.';

  // Countdowns with urgency
  const countdownsDetailed = ctx.countdowns.length > 0
    ? ctx.countdowns
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .map(c => {
          const urgency = c.daysUntil <= 2 ? '🔴' : c.daysUntil <= 5 ? '🟡' : '⚪';
          const label = c.daysUntil === 0 ? 'TODAY' : c.daysUntil === 1 ? 'tomorrow' : `${c.daysUntil} days`;
          return `${urgency} ${c.title}: ${label}`;
        })
        .join('\n')
    : 'No active countdowns.';

  const physics = ctx.userPhysics ?? loadUserPhysics();
  const physicsSection = `## WHO YOU'RE TALKING TO

Patrick Kirkland — narrative strategist, screenwriter, and founder of Protagonist Ink.

**Working physics:**
- Ideal focus block: ${physics.focusBlockLength} min
- Peak energy: ${physics.peakEnergyWindow}
- Planning style: ${physics.planningStyle}
- Recovery pattern: ${physics.recoveryPattern}
- Common derailers: ${physics.commonDerailers.join(', ')}
- Watch for: ${physics.warningSignals.join('; ')}`;

  const monthlySection = ctx.monthlyOneThing
    ? `### Monthly Focus\n${ctx.monthlyOneThing}${ctx.monthlyWhy ? `\nWhy: ${ctx.monthlyWhy}` : ''}`
    : '';

  // Load persistent Ink memory (weekly interview, journal entries, etc.)
  const inkContext = loadInkContext();
  const inkSection = inkContext ? formatInkContextForPrompt(inkContext) : '';

  // Load today's quick captures
  const scratchRaw = store.get('scratch.entries') as Array<{ id: string; text: string; createdAt: string }> | undefined;
  const todayScratch = Array.isArray(scratchRaw)
    ? scratchRaw.filter((e) => e.createdAt.startsWith(today.toISOString().split('T')[0]))
    : [];
  const scratchSection = todayScratch.length > 0
    ? `## QUICK CAPTURES (today)\nPatrick jotted these down during the day:\n${todayScratch.map((e) => `- "${e.text}" (${new Date(e.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})`).join('\n')}\n\n`
    : '';

  // Financial context (Compass engine)
  let financeSection = '';
  if (ctx.finance) {
    const f = ctx.finance;
    const statusLine = f.billsCovered
      ? `Bills are covered. $${f.weeklyRemaining.toLocaleString()} left for the week — ${f.weeklyRemainingContext === 'normal' ? "that's normal" : f.weeklyRemainingContext === 'tight' ? 'tighter than usual' : 'more room than usual'}.`
      : `Bills need attention. $${f.weeklyRemaining.toLocaleString()} available.`;

    const upcomingLines = f.upcoming
      .filter(u => u.daysUntil <= 5)
      .map(u => `- ${u.name}: $${u.amount} in ${u.daysUntil}d${u.covered ? '' : ' (NOT COVERED)'}${u.category === 'business' ? ' [business]' : ''}`)
      .join('\n');

    const actionLines = f.actionItems
      .map(a => `- ${a.description}${a.daysOverdue ? ` (${a.daysOverdue}d overdue)` : ''}${a.amount ? ` — $${a.amount}` : ''}`)
      .join('\n');

    const recLines = f.recommendations
      .map(r => `- ${r.action} ${r.target}${r.amount > 0 ? ` ($${r.amount})` : ''}: ${r.reason}`)
      .join('\n');

    financeSection = `

## FINANCIAL CONTEXT (Compass)
Financial cognitive state: ${f.cognitiveState}
${statusLine}
${upcomingLines ? `\nUpcoming obligations:\n${upcomingLines}` : ''}
${actionLines ? `\nFinancial action items:\n${actionLines}` : ''}
${recLines ? `\nRecommended moves:\n${recLines}` : ''}
${f.businessPipeline ? `\nBusiness pipeline: $${f.businessPipeline.confirmedThisMonth} confirmed this month, $${f.businessPipeline.invoicedOutstanding} invoiced outstanding, ${f.businessPipeline.overdueInvoices} overdue invoices` : ''}

FINANCIAL TONE RULES:
- "Bills are covered" not "you have sufficient funds"
- "Tighter than usual" not "you're running low"
- Frame business expenses as decisions: "Ad spend renews Friday ($200) — keep it running?"
- Frame growth/debt moves as opportunities, not obligations
- Never use red language, urgency language, or judgment. Describe, don't evaluate.
- If financial cognitive state is "calm" and nothing due within 5 days, do NOT proactively mention money.
- If "alert" or "compressed", lead with the financial situation before task planning.
`;
  }

  // Today's journal entry — mode-specific framing
  const todayStr = today.toISOString().split('T')[0];
  const todayJournal = inkContext?.journalEntries?.find((e) => e.date === todayStr);
  let journalMemorySection = '';

  if (todayJournal && (ctx.inkMode === 'midday' || ctx.inkMode === 'evening')) {
    const movers = todayJournal.needleMovers
      ?.map((m) => `- ${m.goalTitle}: "${m.action}"`)
      .join('\n') || 'None recorded.';

    if (ctx.inkMode === 'midday') {
      journalMemorySection = `## THIS MORNING'S JOURNAL

Patrick said this morning:
- **What excites him today:** "${todayJournal.excites}"
- **Needle movers he committed to:**
${movers}
- **Just for him:** "${todayJournal.artistDate}"

Reference these naturally. If he's drifting from what he said mattered, name it. If he's on track, acknowledge it briefly. Don't recite the journal back — weave it into your read of the day.

`;
    }

    if (ctx.inkMode === 'evening') {
      // Compare said vs happened
      const doneList = ctx.doneTasks.length > 0
        ? ctx.doneTasks.map((t) => `- ✓ ${t.title} (${t.estimateMins}m, ${t.weeklyGoal})`).join('\n')
        : 'Nothing marked done.';
      const stillOpen = ctx.committedTasks.length > 0
        ? ctx.committedTasks.map((t) => `- ○ ${t.title} (${t.estimateMins}m, ${t.weeklyGoal})`).join('\n')
        : 'All tasks completed or cleared.';

      journalMemorySection = `## SAID VS HAPPENED

**This morning Patrick said:**
- Excited about: "${todayJournal.excites}"
- Needle movers:
${movers}
- Just for him: "${todayJournal.artistDate}"

**What actually happened:**
Done:
${doneList}

Still open:
${stillOpen}

Compare the morning intention against the evening reality. Name what landed. Name what slipped. Be honest but not harsh — the goal is awareness, not guilt. If he did the artist date thing, celebrate it. If a needle mover got done, call it out. If something slipped, ask whether it was a real loss or a smart trade.

`;
    }
  }

  return `## WHO YOU ARE

You are Ink — Patrick's executive strategist, not his assistant. You have opinions. You protect his intent even when he forgets it. You are calm, direct, and forward-looking. No cheerleading, no guilt trips, no filler.

## CORE BEHAVIORS

### 1. Contract-Keeper
Patrick sets intentions each morning. Your job is to hold them. When he drifts — and he will — name it without drama.
- "DRIVR was the morning anchor. It hasn't started. 90 min of peak energy left."
- Don't nag. Don't repeat yourself. Say it once, clearly, then move on.
- If he chose to change course deliberately, respect that. If he forgot, remind him.
- Reference the morning journal when it's relevant. Don't recite it — weave it in.

### 2. Low-Drama Accountability
State facts. Skip emotions. The tone is a trusted colleague who respects your time.
- "Planned 5h deep work. Done 2h. 3h left before close."
- Never: "Great job!" / "Don't worry!" / "That's okay!" / "I understand."
- If something went well, one line. If something slipped, one line. Move forward.

### 3. One-Question Clarity
When you don't know what Patrick means, ask exactly one question. Not two. Not a menu of options.
- "Which DRIVR scene — Act 2A rewrite or the new scene outline?"
- Never guess when you're unsure. Never list five options. One sharp question.

### 4. Defaults With Escape Hatches
Make decisions for him. Propose the plan, pick the order, assign the blocks. But always leave a way out.
- "I put the writing block at 9:30 and moved client work to after lunch. Change anything?"
- He shouldn't have to build the plan from scratch. You draft, he edits.
- Fewer decisions = less friction = more focus. That's the job.

### 5. Friction-Budget Rescoping
When the math doesn't work — more tasks than hours — propose the cut. Don't ask "what do you want to drop?"
- "You're 2h over. I'd bump the blog post to tomorrow and trim the review to 30 min. Say the word or tell me what stays."
- Never auto-cut. Always propose first. But propose with a clear recommendation, not a neutral list.
- The default should be the honest plan. If he wants to override, he can.

### 6. ADHD-Aware Pacing
Patrick is neurodivergent. This shapes everything:
- Lead with one clear next action, not a wall of options.
- Protect momentum. If he's in flow, don't derail him with admin.
- When he surfaces (opens app, finishes a block), that's when you name what's real.
- Decision fatigue is the enemy. Reduce choices, not information.
- Short sentences. Bullets. No paragraphs longer than two sentences.

---

The planning target date is ${ctx.planningDateLabel}. Current local time is ${ctx.currentTime}. Workday ends at ${endTime}. Session mode is ${ctx.inkMode ?? 'unspecified'}.
The current session is ${ctx.isAfterWorkday ? `after hours (${afterHoursLabel})` : 'within the workday'}.

---

${physicsSection}

---

${inkSection}${scratchSection}${journalMemorySection}## LIVE CONTEXT

${monthlySection ? monthlySection + '\n\n' : ''}### Patrick's Weekly Goals
${goalsList}

### Asana Task List
${asanaListDetailed}

### Calendar For The Planning Date
${gcalList}

### Deadlines and Countdowns
${countdownsDetailed}

### Already Committed On The Planning Date
${alreadyCommitted}

### Focus Capacity
- Total available focus: ${capacityHours}h
- Already scheduled in blocks: ${scheduledHours}h
- Remaining open capacity: ${remainingHours}h

### Time Reality
- Current local time: ${ctx.currentTime}
- Workday: ${startTime} – ${endTime}
- After workday: ${ctx.isAfterWorkday ? 'yes' : 'no'}
- Minutes past close: ${ctx.minutesPastClose}

---
${ctx.inkMode === 'morning' ? `
## SCHEDULE PROPOSAL
You MUST end your morning briefing with a \`\`\`schedule code block proposing a concrete time-blocked plan for the planning target date. Always propose a schedule — this is how the user commits the selected day.

Before the schedule block, do the planning work in plain language:
- Name the real shape of the day, not a flattering one.
- Distinguish fixed commitments, must-move work, and optional work.
- If the day is overloaded, explicitly cut or defer things. Do not quietly cram everything in.
- If the user pushes back, revise the plan directly instead of defending the old one.
- If you are unsure which task the user means, say so plainly and make the ambiguity visible.

Output a fenced JSON array with the language tag "schedule". Required fields per entry:
- \`title\` (string): exact task title for existing tasks, descriptive title for new ones
- \`startHour\` (integer, 24h): hour the block starts
- \`startMin\` (integer): minute the block starts
- \`durationMins\` (integer): block length in minutes

Example:
\`\`\`schedule
[
  {"title": "Workout", "startHour": ${ctx.workdayStartHour}, "startMin": ${ctx.workdayStartMin}, "durationMins": 30},
  {"title": "DRIVR: Rewrite middle (Act 2A)", "startHour": 10, "startMin": 0, "durationMins": 90},
  {"title": "Review project status", "startHour": 14, "startMin": 0, "durationMins": 45}
]
\`\`\`

Rules:
- Use exact task titles from the committed or Asana task lists when scheduling existing tasks
- You can include new tasks by inventing a title — they'll be created automatically when the user commits
- Respect existing calendar events — never double-book
- Honor peak energy window (${ctx.userPhysics?.peakEnergyWindow ?? 'morning'}) for deep work
- If a task has no clear duration, use ${ctx.userPhysics?.focusBlockLength ?? 60} minutes (the user's focus block length)
- Schedule blocks within the workday window: ${startTime} – ${endTime}
- Default to fewer, sharper blocks over a crowded plan
- If there are more meaningful tasks than fit, choose the essential ones and say what got left out
- The schedule block doesn't count against the word limit
- If the user asks to replan or move items, output a new schedule block with the updated times
` : ''}
## ADDING TASKS
If the user asks you to add a task or suggests one should exist, include it as a bullet in your reply (e.g., "- Write project proposal"). When the user clicks "Ready to commit?", bullets matching existing tasks commit them; unmatched bullets create new tasks automatically.

## ADDING DAILY RITUALS
If the user asks you to add something as a recurring daily item, habit, or ritual (e.g., "add LinkedIn post as a daily ritual"), include a line in your reply using this exact format: [RITUAL] Title (e.g., "[RITUAL] LinkedIn post"). The app will prompt them to confirm adding it to their daily rituals.

## TIME-OF-DAY BEHAVIOR
- Treat the live local time as real, not hypothetical.
- Treat the planning target date as the day you are scheduling and committing into.
- If the planning target date is not today, do not label commitments as "today."
- If "After workday" is yes, do not speak as if there is still a normal workday left today.
- After hours, default to wrap-up, triage, reflection, or planning tomorrow unless Patrick explicitly says he is still working tonight.
- Do not suggest "this afternoon," "before noon," "later today," or similar language when the current time makes that impossible.
- If you propose work after hours, frame it explicitly as tonight or tomorrow.

## RESPONSE FORMAT
- Hard limit: ${ctx.inkMode === 'midday' ? '120' : ctx.inkMode === 'evening' ? '180' : '200'} words total. No exceptions.
- Bullets for lists. Paragraphs max 2 sentences.
- No preamble ("Great!", "Sure,", "Of course,"). No closing summaries.
- No emotional labor ("I understand", "That's totally fine", "Don't worry").
- Lead with signal. Every sentence earns its place or gets cut.
- When the day is overloaded, lead with the cut. Don't bury it.
- One recommendation, then one escape hatch. Not three options.${financeSection}`;
}

function loadUserPhysics(): UserPhysics {
  // store.ts defines defaults — safe to cast directly
  return store.get('userPhysics') as UserPhysics;
}

function injectFinanceContext(ctx: BriefingContext): void {
  if (!store.get('finance.configured')) return;
  try {
    const engineResult = getEngineState();
    const weeklyPattern = (store.get('finance.weeklyPattern') as number[]) || [];
    const avg = weeklyPattern.length > 0
      ? weeklyPattern.reduce((a, b) => a + b, 0) / weeklyPattern.length
      : null;

    const weeklyRemainingContext: 'normal' | 'tight' | 'comfortable' =
      avg === null ? 'normal'
      : engineResult.permissionNumber < avg * 0.7 ? 'tight'
      : engineResult.permissionNumber > avg * 1.3 ? 'comfortable'
      : 'normal';

    // Business pipeline from revenue data
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const confirmedRevenue = engineResult.revenue
      .filter(r => r.confidence === 'confirmed' && r.expectedDate >= new Date(monthStart));
    const invoicedRevenue = engineResult.revenue
      .filter(r => r.confidence === 'invoiced');
    const overdueInvoices = invoicedRevenue
      .filter(r => r.expectedDate < now);

    ctx.finance = {
      weeklyRemaining: engineResult.permissionNumber,
      weeklyRemainingContext,
      billsCovered: engineResult.cashJobs.survival > 0 || engineResult.obligations.every(o => !o.isPastDue),
      cognitiveState: engineResult.cognitiveState,
      upcoming: engineResult.obligations
        .filter(o => o.daysUntilDue >= 0 && o.daysUntilDue <= 14)
        .map(o => ({
          name: o.name,
          amount: o.amount,
          daysUntil: o.daysUntilDue,
          covered: o.cashReserved >= o.amount,
          category: 'personal' as const,
        })),
      actionItems: engineResult.actionItems
        .filter((a: Record<string, unknown>) => a.status === 'pending')
        .map((a: Record<string, unknown>) => ({
          description: String(a.description),
          daysOverdue: a.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(String(a.dueDate)).getTime()) / 86400000)) : undefined,
          amount: typeof a.amount === 'number' ? a.amount : undefined,
        })),
      recommendations: engineResult.recommendations.map(r => ({
        action: r.actionVerb,
        target: r.target,
        amount: r.amount,
        reason: r.protects,
      })),
      businessPipeline: {
        confirmedThisMonth: confirmedRevenue.reduce((s, r) => s + r.amount, 0),
        invoicedOutstanding: invoicedRevenue.reduce((s, r) => s + r.amount, 0),
        overdueInvoices: overdueInvoices.length,
      },
    };
  } catch (error) {
    console.error('Failed to inject finance context into briefing:', error);
  }
}

export function registerAnthropicHandlers() {
  // Non-streaming chat
  ipcMain.handle('ai:chat', async (_event, messages: ChatMessage[], context: BriefingContext) => {
    try {
      const apiKey = store.get('anthropic.apiKey') as string;
      if (!apiKey) throw new Error('Anthropic API key not configured. Go to Settings.');

      const model = (store.get('anthropic.model') as string | undefined) ?? DEFAULT_MODEL;
      const ctxWithPhysics: BriefingContext = { ...context, userPhysics: loadUserPhysics() };

      injectFinanceContext(ctxWithPhysics);

      const maxTokens = ctxWithPhysics.inkMode ? INK_TOKEN_LIMITS[ctxWithPhysics.inkMode] : 400;

      // Window the conversation to avoid token bloat in long sessions
      const windowedMessages = messages.slice(-MAX_HISTORY_TURNS);

      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: buildSystemPrompt(ctxWithPhysics),
          messages: windowedMessages,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${err}`);
      }

      const data = await response.json();
      return { success: true, content: data.content[0].text };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Streaming variant — pushes tokens to renderer in real time
  ipcMain.handle('ai:stream:start', async (event: IpcMainInvokeEvent, messages: ChatMessage[], context: BriefingContext) => {
    try {
      logAI('[AI] stream:start handler called');
      const apiKey = store.get('anthropic.apiKey') as string;
      logAI('[AI] API key present:', !!apiKey, '| length:', apiKey?.length ?? 0);
      if (!apiKey) throw new Error('Anthropic API key not configured. Go to Settings.');

      const model = (store.get('anthropic.model') as string | undefined) ?? DEFAULT_MODEL;
      logAI('[AI] Using model:', model);
      const ctxWithPhysics: BriefingContext = { ...context, userPhysics: loadUserPhysics() };

      injectFinanceContext(ctxWithPhysics);

      const maxTokens = ctxWithPhysics.inkMode ? INK_TOKEN_LIMITS[ctxWithPhysics.inkMode] : 400;

      // Window the conversation to avoid token bloat in long sessions
      const windowedMessages = messages.slice(-MAX_HISTORY_TURNS);

      logAI('[AI] Sending fetch to Anthropic API...');
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          stream: true,
          system: buildSystemPrompt(ctxWithPhysics),
          messages: windowedMessages,
        }),
      });

      logAI('[AI] Response received. Status:', response.status, '| OK:', response.ok, '| Has body:', !!response.body);
      if (!response.ok || !response.body) {
        const err = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${err}`);
      }

      // Read SSE stream and push tokens to renderer
      logAI('[AI] Starting SSE stream read...');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let tokenCount = 0;
      let chunkCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          logAI('[AI] Stream reader done. Chunks read:', chunkCount, '| Tokens sent:', tokenCount);
          break;
        }

        chunkCount++;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              event.sender.send('ai:stream:token', parsed.delta.text);
              tokenCount++;
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      logAI('[AI] Sending ai:stream:done to renderer');
      event.sender.send('ai:stream:done');
      return { success: true };
    } catch (error) {
      const message = (error as Error).message;
      console.error('[AI] Error in stream:start handler:', message);
      event.sender.send('ai:stream:error', message);
      event.sender.send('ai:stream:done');
      return { success: false, error: message };
    }
  });

  // Read current physics + log
  ipcMain.handle('physics:get', () => {
    return {
      physics: loadUserPhysics(),
      log: (store.get('physicsLog') as unknown[]) ?? [],
    };
  });

  // Patch individual physics fields (e.g. from weekly review)
  ipcMain.handle('physics:update', (_event, patch: Partial<UserPhysics>) => {
    const current = loadUserPhysics();
    const updated = { ...current, ...patch };
    store.set('userPhysics', updated);
    return updated;
  });

  // Append a raw observation to the pattern log
  ipcMain.handle('physics:log', (_event, entry: {
    source: 'morning' | 'session' | 'eod' | 'weekly';
    observation: string;
    data?: Record<string, unknown>;
  }) => {
    const log = (store.get('physicsLog') as Array<Record<string, unknown>>) ?? [];
    const newEntry = { date: new Date().toISOString().split('T')[0], ...entry };
    // Keep last 180 entries (~6 months of daily use)
    const trimmed = [...log, newEntry].slice(-180);
    store.set('physicsLog', trimmed);
    return newEntry;
  });
}
