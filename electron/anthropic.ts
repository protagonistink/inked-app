import { ipcMain, IpcMainInvokeEvent } from 'electron';
import Store from 'electron-store';

const store = new Store();

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GCalEventContext {
  title: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
}

interface BriefingContext {
  date: string;
  weeklyGoals: Array<{ title: string; why?: string }>;
  asanaTasks: Array<{
    title: string;
    dueOn: string | null;
    priority?: string;
    project?: string;
    daysSinceAdded?: number;
  }>;
  gcalEvents: GCalEventContext[];
  availableFocusMinutes: number;
  scheduledMinutes: number;
  committedTasks: Array<{ title: string; estimateMins: number; weeklyGoal: string }>;
  countdowns: Array<{ title: string; daysUntil: number }>;
  workdayEndHour: number;
  workdayEndMin: number;
}

export function buildSystemPrompt(ctx: BriefingContext): string {
  const goalsList = ctx.weeklyGoals
    .map(g => `- ${g.title}${g.why ? ` (why: ${g.why})` : ''}`)
    .join('\n');

  const asanaList = ctx.asanaTasks.length > 0
    ? ctx.asanaTasks.map(t => {
        const due = t.dueOn
          ? new Date(t.dueOn).toDateString() === new Date().toDateString()
            ? 'DUE TODAY'
            : `due ${t.dueOn}`
          : 'no due date';
        const priority = t.priority ? ` [${t.priority}]` : '';
        const project = t.project ? ` — ${t.project}` : '';
        const age = t.daysSinceAdded != null && t.daysSinceAdded > 7
          ? ` (${t.daysSinceAdded} days old)`
          : '';
        return `- ${t.title}${priority}${project} (${due})${age}`;
      }).join('\n')
    : 'No Asana tasks found.';

  const gcalList = ctx.gcalEvents.length > 0
    ? ctx.gcalEvents.map(e => {
        if (e.isAllDay) return `- All day: ${e.title}`;
        return `- ${e.startTime}–${e.endTime}: ${e.title}`;
      }).join('\n')
    : 'No calendar events today.';

  const countdownsList = ctx.countdowns.length > 0
    ? ctx.countdowns.map(c => `- ${c.title}: ${c.daysUntil} day${c.daysUntil === 1 ? '' : 's'} out`).join('\n')
    : 'No active countdowns.';

  const alreadyCommitted = ctx.committedTasks.length > 0
    ? ctx.committedTasks.map(t => `- ${t.title} (${t.estimateMins}m, ${t.weeklyGoal})`).join('\n')
    : 'Nothing committed yet.';

  const capacityHours = (ctx.availableFocusMinutes / 60).toFixed(1);
  const scheduledHours = (ctx.scheduledMinutes / 60).toFixed(1);
  const endTime = `${ctx.workdayEndHour}:${String(ctx.workdayEndMin).padStart(2, '0')}`;

  return `You are the morning planning voice inside TimeFocus, a focus and planning app.

Today is ${ctx.date}. The workday ends at ${endTime}.

Your job is to run a morning briefing with Patrick — a narrative strategist and screenwriter who runs Protagonist Ink. This is a conversation, not a report. You give him a sharp read of what's real, what's pressing, and what might be lying. He debates with you. Together you land on what actually goes into today's commit.

## Patrick's Weekly Goals
${goalsList}

## Asana Tasks (his current list)
${asanaList}

## Today's Calendar
${gcalList}

## Deadlines and Countdowns
${countdownsList}

## Already Committed Today
${alreadyCommitted}

## Focus Capacity
- Available focus time: ${capacityHours} hours
- Already scheduled: ${scheduledHours} hours

---

## Your character in this conversation

You are direct. You push back. You are not a yes machine.

If a task has been sitting in Asana without movement, say so. If the list is optimistic given the capacity, call it. If one goal is getting ignored all week, name it. If something is due today but isn't in the commit, flag it. If calendar events eat into focus time, factor that in.

You are also not a bureaucrat. You don't lecture. You move fast, you make the read, and you let him respond.

## How the briefing runs

1. Open with a sharp read — not a list dump. Synthesize what you see. What's real today? What's the most pressing thing? What looks like it might be wishful thinking?

2. Let him respond. He'll push back, clarify, cut things, add things. Roll with it.

3. When you've both landed on a real list, summarize it clearly — one line per task, with rough time estimates if helpful. This is the output that goes into the app.

## Formatting rules

- Keep messages conversational. No walls of text.
- Use short paragraphs, not bullet-point lists for everything.
- When you do list tasks (the final agreed list), use a simple dashed list.
- Don't say "Great!" or "Absolutely!" or any of that. Just respond.
- Max response length: ~200 words unless he asks you to go longer.
- Don't repeat the full context back at him. He knows what's in Asana.

## What you never do

- Never tell him everything looks fine if it doesn't.
- Never let an overcommitted plan slide without noting it.
- Never agree with him just to end the conversation.
- Never produce a list longer than the focus capacity realistically allows.`;
}

export function registerAnthropicHandlers() {
  // Non-streaming chat
  ipcMain.handle('ai:chat', async (_event, messages: ChatMessage[], context: BriefingContext) => {
    try {
      const apiKey = store.get('anthropic.apiKey') as string;
      if (!apiKey) throw new Error('Anthropic API key not configured. Go to Settings.');

      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          system: buildSystemPrompt(context),
          messages,
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
      const apiKey = store.get('anthropic.apiKey') as string;
      if (!apiKey) throw new Error('Anthropic API key not configured. Go to Settings.');

      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          stream: true,
          system: buildSystemPrompt(context),
          messages,
        }),
      });

      if (!response.ok || !response.body) {
        const err = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${err}`);
      }

      // Read SSE stream and push tokens to renderer
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              event.sender.send('ai:stream:token', parsed.delta.text);
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      event.sender.send('ai:stream:done');
      return { success: true };
    } catch (error) {
      event.sender.send('ai:stream:done');
      return { success: false, error: (error as Error).message };
    }
  });
}
