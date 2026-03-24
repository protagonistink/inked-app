# Visual Design Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Inked's visual identity from "black and utilitarian" to warm, tactile, and modern — with Satoshi typography, Warm Slate dark mode, Protagonist Rust accent, and brand-tied focus timer.

**Architecture:** CSS-first approach. Update the @theme block in globals.css to change all color tokens, install Satoshi font, then update components that use hardcoded colors or the old Cormorant display font. Each task is a visual change that can be verified by building and opening the app.

**Tech Stack:** Tailwind CSS v4, CSS custom properties, Satoshi (Fontshare), React 18, Electron

**Spec:** `docs/superpowers/specs/2026-03-23-visual-design-phase2.md`

---

## File Structure

### Files to modify
- `src/styles/globals.css` — @theme color tokens, font import, light/dark/focus theme variants, animations
- `package.json` — add Satoshi font package (if using @fontsource) or confirm CDN approach
- `src/components/timeline/BlockCard.tsx` — stripe+gradient block style, intention colors
- `src/components/timeline/Timeline.tsx` — current time indicator color
- `src/components/timeline/CurrentTimeIndicator.tsx` — rust color, dot styling
- `src/components/focus/FocusView.tsx` — ring+ink bleed, icon controls, kill Cormorant
- `src/components/PomodoroTimer.tsx` — ring color (rust not red), icon controls
- `src/components/rail/RightRail.tsx` — clean section styling, intention color update
- `src/components/rail/FocusCapacity.tsx` — italic Ink voice styling
- `src/components/rail/BalanceAwareness.tsx` — italic muted styling
- `src/components/chrome/Sidebar.tsx` — glassmorphic backdrop-filter
- `src/modes/BriefingMode.tsx` — welcome screen warm gradient
- `src/components/ink/MorningWelcome.tsx` — morning greeting styling

### No new files needed
This is a styling pass on existing components.

---

## Task Sequence

### Task 1: Install Satoshi font and update typography tokens

**Files:**
- Modify: `src/styles/globals.css` — font import, @theme font variables, kill Cormorant

- [ ] **Step 1: Add Satoshi font import to globals.css**

At the top of `src/styles/globals.css`, add:
```css
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap');
```

- [ ] **Step 2: Update @theme font variables**

In the `@theme` block, find the font variables and change:
```css
/* Before: */
--font-sans: 'Satoshi';
--font-display: 'Cormorant Garamond';

/* After: */
--font-sans: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
--font-display: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
```

This kills Cormorant everywhere by making `font-display` also use Satoshi. Components using `font-display` will now get Satoshi instead of Cormorant italic.

- [ ] **Step 3: Remove any Cormorant font imports**

Search globals.css for any `@import` or `@font-face` referencing Cormorant and remove them.

- [ ] **Step 4: Update FocusView.tsx task title**

In `src/components/focus/FocusView.tsx`, the task title uses `font-display italic text-3xl`. Change to:
```tsx
// Before:
className="font-display italic text-3xl text-text-emphasis"
// After:
className="font-sans text-[28px] font-bold tracking-[-0.02em] text-text-emphasis"
```

- [ ] **Step 5: Search for all `font-display` and `italic` usages tied to Cormorant**

Grep for `font-display` across the codebase. Any usage that was relying on Cormorant's italic should be updated to Satoshi bold. Key places to check:
- `PomodoroTimer.tsx` timebox toast (task title uses `font-display text-[15px] italic`)
- Any modal headers
- Focus resume prompt in App.tsx

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: Clean build. Satoshi loads via CDN.

- [ ] **Step 7: Commit**

```bash
git add src/styles/globals.css src/components/focus/FocusView.tsx src/components/PomodoroTimer.tsx
git commit -m "feat: install Satoshi font, kill Cormorant italic

Satoshi loaded via Fontshare CDN. font-display now maps to Satoshi.
All Cormorant italic references updated to Satoshi bold."
```

---

### Task 2: Update dark mode color tokens

**Files:**
- Modify: `src/styles/globals.css` — @theme colors and dark theme variant

- [ ] **Step 1: Update the @theme color block**

Find and replace the color values in the `@theme` block:
```css
/* Before: */
--color-bg: #0A0A0A;
--color-bg-elevated: #1A1A1A;
--color-bg-card: #2C2C2C;
--color-accent-warm: #E55547;
--color-text-primary: #F5F5F5;
--color-text-muted: #999999;
--color-border-subtle: rgba(250,250,250,0.07);

/* After: */
--color-bg: #1c1b22;
--color-bg-elevated: #252430;
--color-bg-card: #2e2d38;
--color-accent-warm: #C83C2F;
--color-accent-warm-hover: #f47252;
--color-text-primary: rgba(255,248,235,0.92);
--color-text-emphasis: rgba(255,248,235,0.95);
--color-text-muted: rgba(255,240,220,0.35);
--color-text-secondary: rgba(255,240,220,0.48);
--color-text-whisper: rgba(255,240,220,0.15);
--color-border: rgba(255,240,220,0.06);
--color-border-subtle: rgba(255,240,220,0.04);
--color-surface: rgba(255,240,220,0.025);
```

- [ ] **Step 2: Add accent-warm-hover to any hover state utilities**

Search globals.css for hover state definitions. Add the coral hover variant where needed. Also check if Tailwind v4 auto-generates `accent-warm-hover` from the variable or if we need explicit utility.

- [ ] **Step 3: Update the focus theme variant**

Find `[data-theme="focus"]` and update its colors to use the warm slate palette with deeper values:
```css
[data-theme="focus"] {
  --color-bg: #16151c;
  --color-bg-elevated: #1c1b22;
  --color-text-primary: rgba(255,248,235,0.85);
  /* ... other focus-specific overrides */
}
```

- [ ] **Step 4: Verify build and visual spot-check**

Run: `npm run build`
Expected: Clean build. Dark mode should now show warm slate instead of pure black.

- [ ] **Step 5: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: update dark mode to Warm Slate color system

Background #0A0A0A -> #1c1b22 (purple-charcoal).
Text pure white -> cream-white.
Accent #E55547 -> Protagonist Rust #C83C2F.
Added coral #f47252 for hover/active states."
```

---

### Task 3: Update light mode color tokens

**Files:**
- Modify: `src/styles/globals.css` — light theme variant

- [ ] **Step 1: Update `[data-theme="light"]` block**

Find the light theme section and update:
```css
[data-theme="light"] {
  --color-bg: #FAFAFA;
  --color-bg-elevated: #F5F2EE;
  --color-bg-card: #EFEBE5;
  --color-accent-warm: #C83C2F;
  --color-accent-warm-hover: #f47252;
  --color-text-primary: rgba(40,30,20,0.9);
  --color-text-emphasis: rgba(40,30,20,0.95);
  --color-text-muted: rgba(60,50,40,0.4);
  --color-text-secondary: rgba(60,50,40,0.5);
  --color-text-whisper: rgba(60,50,40,0.2);
  --color-border: rgba(60,50,40,0.08);
  --color-border-subtle: rgba(60,50,40,0.06);
  --color-surface: rgba(60,50,40,0.03);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: update light mode to Warm Paper color system

Background -> #FAFAFA (Protagonist brand white).
Text -> warm brown. Intentional, not just inverted dark."
```

---

### Task 4: Update intention colors and timeline blocks

**Files:**
- Modify: `src/components/rail/RightRail.tsx` — intention color array
- Modify: `src/components/timeline/BlockCard.tsx` — stripe+gradient style
- Modify: `src/components/timeline/CurrentTimeIndicator.tsx` — rust color

- [ ] **Step 1: Update INTENTION_COLORS in RightRail.tsx**

Find the `INTENTION_COLORS` array and replace:
```typescript
// Before:
const INTENTION_COLORS = [
  'rgba(229,85,71,0.5)',
  'rgba(74,109,140,0.45)',
  'rgba(145,159,174,0.35)',
];

// After:
const INTENTION_COLORS = [
  'rgba(167,139,250,0.7)',  // purple
  'rgba(45,212,191,0.6)',   // teal
  'rgba(251,191,36,0.6)',   // amber
];
```

Also update any corresponding full-opacity versions used for text or fills.

- [ ] **Step 2: Update BlockCard to use stripe+gradient style**

In `src/components/timeline/BlockCard.tsx`, find the block styling logic. Replace the current intention color application with:

For task blocks:
```tsx
style={{
  borderLeft: `3px solid ${intentionColor}`,
  background: `linear-gradient(90deg, ${intentionColor.replace(/[\d.]+\)$/, '0.06)')} 0%, rgba(255,240,220,0.02) 40%)`,
  border: '1px solid rgba(255,240,220,0.04)',
  borderRadius: '2px 8px 8px 2px',
}}
```

For the NOW/active block, add a rust glow:
```tsx
boxShadow: isActive ? '0 0 0 1px rgba(200,60,47,0.3), 0 2px 10px rgba(200,60,47,0.05)' : undefined
```

For ritual blocks, use dashed border:
```tsx
borderLeft: `3px dashed rgba(255,240,220,0.1)`,
border: '1px dashed rgba(255,240,220,0.06)',
```

- [ ] **Step 3: Update CurrentTimeIndicator color**

In `src/components/timeline/CurrentTimeIndicator.tsx`, update the color values:
- Time label: `rgba(200,60,47,0.5)` (was `rgba(229,85,71,0.5)`)
- Dot: rust color
- Line gradient: `rgba(200,60,47,0.3)` (was `rgba(229,85,71,0.3)`)

- [ ] **Step 4: Update the intention badge colors in FocusView.tsx**

Make sure FocusView uses the new purple/teal/amber palette for intention badges.

- [ ] **Step 5: Verify build**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/components/timeline/BlockCard.tsx src/components/timeline/CurrentTimeIndicator.tsx src/components/rail/RightRail.tsx src/components/focus/FocusView.tsx
git commit -m "feat: stripe+gradient timeline blocks with purple/teal/amber intentions

Block cards now use left stripe with gradient fade.
Intention colors updated to purple, teal, amber.
Current time indicator uses Protagonist Rust.
Active block gets rust glow ring."
```

---

### Task 5: Update focus mode — ring + ink bleed

**Files:**
- Modify: `src/components/focus/FocusView.tsx` — ring timer, ink bleed, icon controls
- Modify: `src/components/PomodoroTimer.tsx` — ring color, remove word labels

- [ ] **Step 1: Update PomodoroTimer ring colors**

In `src/components/PomodoroTimer.tsx`, find the SVG circle stroke colors:
```tsx
// Before:
stroke="#dc2626"  // work
stroke="#38bdf8"  // break

// After:
stroke="rgba(200,60,47,0.5)"  // work — Protagonist Rust
stroke="rgba(45,212,191,0.5)"  // break — teal (calming, distinct from work)
```

Also update the ring size to match spec: radius 72, viewBox 160x160, stroke-width 3.

- [ ] **Step 2: Replace word buttons with icon controls in PomodoroTimer**

Replace the text buttons ("I'm done", "Keep going", "Re-scope") in the timebox toast with icon buttons:
- Pause: `‖` icon in 36px circle
- Reset: `↺` icon in 36px circle
- Done: `✓` checkmark in 44px circle with rust styling

Use lucide-react icons: `Pause`, `RotateCcw`, `Check`.

- [ ] **Step 3: Add ink bleed to FocusView**

In `src/components/focus/FocusView.tsx`, add the ink bleed background element. This is a div that fills from left based on timer progress:

```tsx
{/* Ink bleed — synced with timer progress */}
<div
  className="absolute inset-0 transition-[width] duration-1000 ease-linear"
  style={{
    width: `${progress * 100}%`,
    background: 'linear-gradient(90deg, rgba(200,60,47,0.07) 0%, rgba(200,60,47,0.04) 70%, transparent 100%)',
  }}
/>
{/* Feathered edge */}
<div
  className="absolute top-0 bottom-0 blur-[8px] transition-[left] duration-1000 ease-linear"
  style={{
    left: `${progress * 100}%`,
    width: '40px',
    background: 'linear-gradient(90deg, rgba(200,60,47,0.04), transparent)',
  }}
/>
```

`progress` should be computed from the PomodoroState: `1 - (timeRemaining / totalTime)`.

- [ ] **Step 4: Add last-5-minutes color shift**

When `timeRemaining <= 300` (5 minutes), shift the ring stroke toward coral:
```tsx
const ringColor = timeRemaining <= 300
  ? 'rgba(244,114,82,0.6)'  // coral
  : 'rgba(200,60,47,0.5)';  // rust
```

- [ ] **Step 5: Update FocusView controls to icon buttons**

Replace the text "I'm done" and "Pause" buttons with the icon circle pattern:
```tsx
<div className="flex gap-5 items-center">
  {/* Pause */}
  <button className="w-9 h-9 rounded-full bg-[rgba(255,240,220,0.03)] border border-[rgba(255,240,220,0.06)] flex items-center justify-center">
    <Pause className="w-3.5 h-3.5 text-[rgba(255,240,220,0.4)]" />
  </button>
  {/* Reset */}
  <button className="w-9 h-9 rounded-full bg-[rgba(255,240,220,0.03)] border border-[rgba(255,240,220,0.06)] flex items-center justify-center">
    <RotateCcw className="w-3.5 h-3.5 text-[rgba(255,240,220,0.4)]" />
  </button>
  {/* Done */}
  <button className="w-11 h-11 rounded-full bg-[rgba(200,60,47,0.1)] border border-[rgba(200,60,47,0.25)] flex items-center justify-center">
    <Check className="w-[18px] h-[18px] text-[rgba(220,100,85,0.9)]" strokeWidth={2.5} />
  </button>
</div>
```

- [ ] **Step 6: Verify build**

Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add src/components/focus/FocusView.tsx src/components/PomodoroTimer.tsx
git commit -m "feat: focus mode ring + ink bleed timer with icon controls

Ring draws in rust, shifts to coral in last 5 minutes.
Background ink bleed fills left-to-right synced with progress.
Text buttons replaced with icon circles (pause, reset, done)."
```

---

### Task 6: Right rail clean section styling

**Files:**
- Modify: `src/components/rail/RightRail.tsx` — divider styling
- Modify: `src/components/rail/FocusCapacity.tsx` — italic Ink voice
- Modify: `src/components/rail/BalanceAwareness.tsx` — italic muted
- Modify: `src/components/rail/IntentionsSummary.tsx` — color dot update
- Modify: `src/components/rail/MoneyMoves.tsx` — rust for due-soon
- Modify: `src/components/rail/HardDeadlines.tsx` — rust for urgent

- [ ] **Step 1: Update RightRail container**

Ensure the rail uses:
- Width: 240px
- `border-left: 1px solid rgba(255,240,220,0.04)`
- Sections separated by `<div className="h-px bg-[rgba(255,240,220,0.04)]" />`
- Section headers: `text-[10px] font-medium uppercase tracking-[0.08em] text-[rgba(255,240,220,0.3)]`
- No card wrappers — just content and dividers

- [ ] **Step 2: Update FocusCapacity to Ink's voice**

Ensure capacity text is italic: `font-medium italic text-[14px] text-[rgba(255,240,220,0.88)]`
Sub-line: `text-[11px] text-[rgba(255,240,220,0.25)]`

- [ ] **Step 3: Update IntentionsSummary color dots**

Use the new purple/teal/amber palette for dots:
```tsx
const DOT_COLORS = [
  'rgba(167,139,250,0.7)',
  'rgba(45,212,191,0.6)',
  'rgba(251,191,36,0.6)',
];
```

- [ ] **Step 4: Update MoneyMoves and HardDeadlines accent**

Due-soon amounts and urgent deadlines should use `text-[rgba(200,60,47,0.7)]` (rust).

- [ ] **Step 5: Verify build**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/components/rail/
git commit -m "feat: right rail clean section styling with Ink's voice

Dividers instead of cards. Italic capacity in Ink's voice.
Purple/teal/amber intention dots. Rust for urgent items."
```

---

### Task 7: Glassmorphic sidebar

**Files:**
- Modify: `src/components/chrome/Sidebar.tsx`

- [ ] **Step 1: Add glassmorphic styling to expanded state**

When the sidebar is expanded (hovered), apply:
```tsx
className={cn(
  'fixed top-0 left-0 bottom-0 z-50 transition-all duration-200 ease-out',
  isExpanded
    ? 'w-[200px] backdrop-blur-[16px] bg-[rgba(28,27,34,0.85)] border-r border-[rgba(255,240,220,0.06)] shadow-[4px_0_24px_rgba(0,0,0,0.2)]'
    : 'w-12 bg-bg-elevated border-r border-border-subtle'
)}
```

- [ ] **Step 2: Verify the blur effect renders in Electron**

Note: `backdrop-filter: blur()` requires Electron's GPU acceleration. Should work by default. If not, may need `app.commandLine.appendSwitch('enable-features', 'CSSBackdropFilter')` in main.ts.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/chrome/Sidebar.tsx
git commit -m "feat: glassmorphic sidebar — blur + transparency on hover

backdrop-filter: blur(16px) with 85% opacity warm slate.
Subtle shadow on expand. Smooth 200ms transition."
```

---

### Task 8: Morning welcome screen

**Files:**
- Modify: `src/modes/BriefingMode.tsx` or `src/components/ink/MorningWelcome.tsx`

- [ ] **Step 1: Add warm gradient to morning opening**

The top section of the briefing mode should have a subtle warm gradient:
```tsx
<div className="bg-gradient-to-b from-[rgba(200,60,47,0.04)] via-transparent to-transparent pt-20 pb-8 px-8">
  <div className="text-[24px] font-bold tracking-[-0.02em] text-text-primary">
    Good morning, Pat.
  </div>
  <div className="text-[14px] text-text-secondary mt-2">
    {/* Ink's opening line — populated by the briefing system */}
  </div>
</div>
```

- [ ] **Step 2: Evening variant**

For evening reflection, use a cooler tone:
```tsx
from-[rgba(45,212,191,0.03)]
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/modes/BriefingMode.tsx src/components/ink/MorningWelcome.tsx
git commit -m "feat: warm gradient morning welcome, cool evening variant"
```

---

### Task 9: Interaction polish — text selectability and hover states

**Files:**
- Modify: `src/styles/globals.css` — global selectability rules
- Modify: `src/components/timeline/BlockCard.tsx` — user-select none
- Modify: various components — hover state updates to use coral

- [ ] **Step 1: Add global user-select rules**

In globals.css, add:
```css
/* Prevent text selection on interactive elements */
.block-card, .task-pill, .nav-item, .sidebar-item {
  user-select: none;
  -webkit-user-select: none;
}
```

Or apply `select-none` class directly to BlockCard's outer div and similar interactive elements.

- [ ] **Step 2: Update hover states to use coral**

Search for `hover:text-accent-warm` and `hover:border-accent-warm` patterns. These should transition to the coral color on hover. If Tailwind v4 supports `accent-warm-hover` from the CSS variable, use that. Otherwise, use explicit `hover:text-[#f47252]`.

Key places:
- Sidebar nav items
- Ink FAB button
- Right rail Ink link
- Command palette items
- Settings buttons

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: interaction polish — no text selection on blocks, coral hover states"
```

---

### Task 10: Mode transition animations

**Files:**
- Modify: `src/App.tsx` — add transition wrapper
- Modify: `src/styles/globals.css` — transition keyframes if needed

- [ ] **Step 1: Add fade transitions between modes**

Wrap the mode router in App.tsx with a transition. Simple approach using CSS transitions on a wrapper div:

```tsx
<div className="transition-opacity duration-300 ease-out">
  {/* mode router content */}
</div>
```

Or use the `motion` library (already installed) for enter/exit animations on each mode component.

- [ ] **Step 2: Add inbox collapse animation**

The inbox in PlanningMode already has a width transition. Verify it uses:
```css
transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 400ms;
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/styles/globals.css
git commit -m "feat: smooth mode transitions — fade between briefing/planning/executing/focus"
```

---

### Task 11: Final cleanup and verification

- [ ] **Step 1: Grep for old color values**

Search for hardcoded old colors that weren't caught:
- `#0A0A0A` (old bg)
- `#1A1A1A` (old elevated)
- `#E55547` (old accent)
- `#dc2626` (old timer red)
- `#38bdf8` (old timer blue)
- `Cormorant` (old font)
- `#F5F5F5` (old text)

Fix any remaining references.

- [ ] **Step 2: Grep for old intention colors**

Search for `rgba(229,85,71` and `rgba(74,109,140` and `rgba(145,159,174` — the old 3-color palette. Replace with purple/teal/amber.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All non-db tests pass

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Clean build

- [ ] **Step 5: Manual smoke test checklist**

Tell user to verify in Electron:
- [ ] Dark mode uses warm slate, not pure black
- [ ] Light mode uses warm paper, not broken white
- [ ] Satoshi font loads (check headings and body)
- [ ] No Cormorant italic anywhere
- [ ] Timeline blocks have left stripe + gradient fade
- [ ] Intention colors are purple, teal, amber
- [ ] Current time indicator is rust
- [ ] Active block has rust glow
- [ ] Ritual blocks have dashed borders
- [ ] Focus mode shows ring + ink bleed
- [ ] Timer ring is rust, shifts to coral in last 5 min
- [ ] Focus controls are icon circles
- [ ] Right rail has clean sections, no cards
- [ ] Sidebar glassmorphs on hover
- [ ] Morning opening has warm gradient
- [ ] Hover states use coral
- [ ] No text selection on draggable elements

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: visual cleanup — remaining old colors and font references"
```
