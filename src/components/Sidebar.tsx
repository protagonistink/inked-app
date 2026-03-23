import { useState } from 'react';
import { CalendarDays, Target, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { InkedLogo } from './InkedLogo';

interface SidebarProps {
  onSettingsClick: () => void;
}

export function Sidebar({ onSettingsClick }: SidebarProps) {
  const [hovered, setHovered] = useState(false);
  const { view, setView } = useApp();

  const navItems = [
    {
      icon: CalendarDays,
      label: 'Flow',
      active: view === 'flow',
      onClick: () => setView('flow'),
    },
    {
      icon: Target,
      label: 'Intentions',
      active: view === 'intentions',
      onClick: () => setView('intentions'),
    },
  ];

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-50 flex flex-col"
      style={{ width: hovered ? 200 : 48 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Background — solid panel */}
      <div
        className={cn(
          'absolute inset-0 transition-[width] duration-200 ease-out bg-bg-elevated border-r border-border-subtle',
          hovered ? 'w-[200px]' : 'w-12'
        )}
      />

      {/* Content */}
      <div className="relative flex flex-col h-full overflow-hidden">
        {/* Logo area — drag region */}
        <div className="drag-region shrink-0 flex items-center pt-[72px] pb-4 px-3">
          <InkedLogo
            collapsed={!hovered}
            className={hovered ? 'ml-1 w-full max-w-[140px]' : 'mx-auto h-[32px] w-[32px] p-0.5'}
          />
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 px-2 flex-1">
          {navItems.map(({ icon: Icon, label, active, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              title={!hovered ? label : undefined}
              className={cn(
                'no-drag flex items-center rounded-md text-[13px] transition-all duration-150',
                hovered ? 'gap-3 px-3 py-2' : 'justify-center px-1 py-2.5',
                active
                  ? 'text-accent-warm bg-accent-warm/8'
                  : 'text-text-muted/70 hover:text-text-primary hover:bg-bg-card/60'
              )}
            >
              <Icon
                className={cn(
                  'shrink-0 stroke-[1.5]',
                  hovered ? 'w-4 h-4' : 'w-[18px] h-[18px]',
                  active && 'text-accent-warm'
                )}
              />
              {hovered && (
                <span className="whitespace-nowrap overflow-hidden">{label}</span>
              )}
              {/* Active indicator dot — visible in collapsed state */}
              {!hovered && active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent-warm rounded-r-full" />
              )}
            </button>
          ))}
        </nav>

        {/* Bottom: Settings */}
        <div className="shrink-0 border-t border-border-subtle px-2 py-3">
          <button
            onClick={onSettingsClick}
            title={!hovered ? 'Settings' : undefined}
            className={cn(
              'no-drag w-full flex items-center rounded-md text-[13px] text-text-muted/70 transition-all duration-150 hover:text-text-primary hover:bg-bg-card/60',
              hovered ? 'gap-3 px-3 py-2' : 'justify-center px-1 py-2.5'
            )}
          >
            <Settings
              className={cn(
                'shrink-0 stroke-[1.5]',
                hovered ? 'w-4 h-4' : 'w-[18px] h-[18px]'
              )}
            />
            {hovered && <span className="whitespace-nowrap overflow-hidden">Settings</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
