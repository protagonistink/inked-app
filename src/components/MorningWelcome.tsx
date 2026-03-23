import { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
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
  const { weeklyGoals, userName } = useApp();
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
        className="font-display italic font-light leading-tight mb-4"
        style={{ color: '#FFFFFF', fontSize: compact ? '2.4rem' : '4rem' }}
      >
        {greeting}
      </h1>

      {/* B. Weekly Threads */}
      <div className="mt-6">
        <span
          className="text-[10px] uppercase tracking-widest block mb-3"
          style={{ color: '#64748B' }}
        >
          This week&apos;s threads
        </span>
        <div className="flex flex-row flex-wrap gap-3">
          {weeklyGoals.map((goal) => (
            <span
              key={goal.id}
              className="text-sm px-3 py-1 rounded-full"
              style={{
                border: '1px solid #334155',
                background: 'transparent',
                color: '#CBD5E1',
              }}
            >
              {goal.title}
            </span>
          ))}
        </div>
      </div>

      {/* C. No task card */}

      {/* D. Grounding Prompt */}
      <p
        className="font-display italic font-light"
        style={{ color: '#F8FAFC', fontSize: compact ? '1.15rem' : '1.5rem', marginTop: compact ? '2.75rem' : '5rem' }}
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
          className="morning-welcome-input bg-transparent border-0 border-b border-[#475569] py-2 text-[15px] text-[#CBD5E1] focus:outline-none focus:ring-0"
          style={{ width: compact ? '100%' : '18rem' }}
        />
        <button
          onClick={handleSubmit}
          className="morning-welcome-cta bg-transparent border-none cursor-pointer text-[14px] transition-colors duration-300"
        >
          {promptCopy.cta}
        </button>
      </div>
    </div>
  );
}
