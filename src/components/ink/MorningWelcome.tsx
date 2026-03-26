import { useState, useMemo } from 'react';
import { usePlanner } from '@/context/AppContext';
import type { InkMode } from '@/types';

const GREETINGS_MORNING = [
  (name: string) => `Good morning, ${name}.`,
  (name: string) => `Morning, ${name}.`,
  (name: string) => `The day is yours, ${name}.`,
  (name: string) => `Fresh page, ${name}.`,
  (name: string) => `Here we go, ${name}.`,
];

const GREETINGS_MIDDAY = [
  (name: string) => `Afternoon, ${name}.`,
  (name: string) => `Still here, ${name}.`,
  (name: string) => `Half the day down, ${name}.`,
  (name: string) => `Back at it, ${name}.`,
  (name: string) => `Let's recalibrate, ${name}.`,
];

const GREETINGS_EVENING = [
  (name: string) => `Evening, ${name}.`,
  (name: string) => `Winding down, ${name}.`,
  (name: string) => `Almost there, ${name}.`,
  (name: string) => `One last look, ${name}.`,
  (name: string) => `End of the line, ${name}.`,
];

function pickGreeting(name: string): string {
  const hour = new Date().getHours();
  const pool = hour < 12 ? GREETINGS_MORNING : hour < 18 ? GREETINGS_MIDDAY : GREETINGS_EVENING;
  return pool[Math.floor(Math.random() * pool.length)](name);
}

interface MorningWelcomeProps {
  onStartDay: (intention: string) => void;
  compact?: boolean;
  inkMode?: InkMode;
  mode?: 'briefing' | 'chat';
}

function getPromptCopy(inkMode: InkMode | undefined, mode: 'briefing' | 'chat') {
  if (inkMode === 'evening') {
    return {
      prompt: mode === 'chat' ? 'What needs clearing before you stop for the night?' : 'What still matters tonight?',
      placeholder: mode === 'chat' ? 'What do you need to sort out?' : 'What still matters tonight?',
      cta: mode === 'chat' ? 'Work it through ->' : 'Close out the day ->',
    };
  }

  if (inkMode === 'midday') {
    return {
      prompt: mode === 'chat' ? 'What needs to move before the day gets away from you?' : 'What needs to move next?',
      placeholder: 'What needs to move next?',
      cta: mode === 'chat' ? 'Talk it through ->' : 'Recalibrate the day ->',
    };
  }

  return {
    prompt: 'What absolutely needs to move today?',
    placeholder: 'What matters, what is fixed, what can wait...',
    cta: 'Map the day ->',
  };
}

export function MorningWelcome({ onStartDay, compact = false, inkMode, mode = 'briefing' }: MorningWelcomeProps) {
  const { weeklyGoals, userName } = usePlanner();
  const greeting = useMemo(() => pickGreeting(userName), [userName]);
  const [intention, setIntention] = useState('');
  const promptCopy = useMemo(() => getPromptCopy(inkMode, mode), [inkMode, mode]);

  const handleSubmit = () => {
    if (!intention.trim()) return;
    onStartDay(intention.trim());
  };

  return (
    <div className="flex flex-col justify-center h-full">
      {/* A. Greeting */}
      <h1
        className="font-display font-bold leading-tight mb-4 tracking-[-0.02em]"
        style={{ color: 'var(--color-text-emphasis)', fontSize: compact ? '24px' : '4rem' }}
      >
        {greeting}
      </h1>

      {/* B. Weekly Threads */}
      <div className="mt-6">
        <span
          className="text-[10px] uppercase tracking-widest block mb-3"
          style={{ color: 'var(--color-text-muted)' }}
        >
          This week&apos;s threads
        </span>
        <div className="flex flex-row flex-wrap gap-3">
          {weeklyGoals.map((goal) => (
            mode === 'chat' ? (
              <button
                key={goal.id}
                onClick={() => onStartDay(`Let's talk about: ${goal.title}`)}
                className="text-sm px-3 py-1 rounded-full cursor-pointer transition-colors"
                style={{
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text-primary)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-text-secondary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; }}
              >
                {goal.title}
              </button>
            ) : (
              <span
                key={goal.id}
                className="text-sm px-3 py-1 rounded-full"
                style={{
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-text-primary)',
                }}
              >
                {goal.title}
              </span>
            )
          ))}
        </div>
      </div>

      {/* C. No task card */}

      {mode === 'chat' && (
        <div
          className="flex items-center gap-3 mt-8"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
          <span className="text-[11px] uppercase tracking-[0.14em]">or</span>
          <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
        </div>
      )}

      {/* D. Grounding Prompt */}
      <p
        className="font-display font-medium"
        style={{ color: 'var(--color-text-emphasis)', fontSize: compact ? '1.15rem' : '1.5rem', marginTop: mode === 'chat' ? '1.5rem' : (compact ? '2.75rem' : '5rem') }}
      >
        {promptCopy.prompt}
      </p>

      {/* E. Input + CTA */}
      <div className="flex flex-row items-center gap-4 mt-6 flex-wrap">
        <input
          type="text"
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={promptCopy.placeholder}
          autoFocus
          className="morning-welcome-input bg-transparent border-0 border-b py-2 text-[15px] focus:outline-none focus:ring-0"
          style={{ width: compact ? '100%' : '18rem', borderColor: 'var(--color-border-hover)', color: 'var(--color-text-primary)' }}
        />
        <button
          onClick={handleSubmit}
          className="morning-welcome-cta bg-transparent border-none cursor-pointer text-[14px] transition-colors duration-300 text-text-secondary hover:text-text-primary"
        >
          {promptCopy.cta}
        </button>
      </div>
    </div>
  );
}
