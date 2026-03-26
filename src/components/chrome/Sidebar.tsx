import { useState } from 'react';
import { CalendarDays, Menu, PenLine, StickyNote, Target, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppShell, usePlanner } from '@/context/AppContext';
import { InkedLogo } from '../shared/InkedLogo';
import { OverlaySurface } from '../shared/OverlaySurface';

interface SidebarProps {
  onSettingsClick: () => void;
  onPlotClick: () => void;
  onCaptureClick: () => void;
  captureCount: number;
}

export function Sidebar({ onSettingsClick, onPlotClick, onCaptureClick, captureCount }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const { mode, view, openPlanning } = useAppShell();
  const { setViewDate } = usePlanner();
  const inPlot = mode === 'briefing';

  const navItems = [
    {
      icon: PenLine,
      label: 'Plot',
      active: inPlot,
      onClick: () => { onPlotClick(); setOpen(false); },
    },
    {
      icon: CalendarDays,
      label: 'Flow',
      active: !inPlot && view === 'flow',
      onClick: () => { setViewDate(new Date()); openPlanning('flow'); setOpen(false); },
    },
    {
      icon: Target,
      label: 'Intentions',
      active: !inPlot && view === 'intentions',
      onClick: () => { openPlanning('intentions'); setOpen(false); },
    },
  ];

  return (
    <>
      {/* Collapsed strip — always visible */}
      <aside
        aria-label="Main navigation"
        className="fixed left-0 top-0 bottom-0 z-50 w-12 flex flex-col items-center bg-bg-elevated border-r border-border-subtle"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Hamburger toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="no-drag mt-[40px] mb-4 p-2 rounded-md text-text-secondary hover:text-text-emphasis hover:bg-surface/70 transition-colors"
          title={open ? 'Close menu' : 'Open menu'}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="w-[18px] h-[18px] stroke-[1.5]" /> : <Menu className="w-[18px] h-[18px] stroke-[1.5]" />}
        </button>

        {/* Collapsed nav icons */}
        <nav className="flex flex-col gap-1.5 items-center">
          {navItems.map(({ icon: Icon, label, active, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              title={label}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'no-drag relative flex items-center justify-center rounded-md p-2 transition-colors',
                active
                  ? 'text-accent-warm bg-accent-warm/8'
                  : 'text-text-secondary hover:text-accent-warm-hover hover:bg-bg-card/60'
              )}
            >
              <Icon className={cn('w-[18px] h-[18px] stroke-[1.5]', active && 'text-accent-warm')} />
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent-warm rounded-r-full" />
              )}
            </button>
          ))}
        </nav>

        {/* Captures */}
        <div className="mt-auto mb-1">
          <button
            onClick={onCaptureClick}
            title="Quick Captures"
            aria-label="Quick Captures"
            className="no-drag relative flex items-center justify-center rounded-md p-2 text-text-secondary hover:text-accent-warm-hover hover:bg-bg-card/60 transition-colors"
          >
            <StickyNote className="w-[18px] h-[18px] stroke-[1.5]" />
            {captureCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>
        </div>

        {/* Settings — bottom */}
        <div className="mb-3">
          <button
            onClick={onSettingsClick}
            title="Settings"
            aria-label="Settings"
            className="no-drag flex items-center justify-center rounded-md p-2 text-text-secondary hover:text-text-emphasis hover:bg-bg-card/60 transition-colors"
          >
            <Settings className="w-[18px] h-[18px] stroke-[1.5]" />
          </button>
        </div>
      </aside>

      {/* Expanded overlay panel */}
      {open && (
        <OverlaySurface
          open
          onClose={() => setOpen(false)}
          labelledBy="main-menu-title"
          containerClassName="z-[55]"
          panelClassName="fixed left-12 top-0 bottom-0 z-[60] w-[200px] bg-bg-elevated/95 backdrop-blur-[16px] border-r border-border shadow-[4px_0_24px_rgba(0,0,0,0.18)] flex flex-col animate-slide-in-left"
        >
          <span id="main-menu-title" className="sr-only">Main menu</span>
            {/* Logo */}
            <div className="pt-[58px] pb-6 px-5">
              <InkedLogo collapsed={false} className="w-full max-w-[140px]" />
            </div>

            {/* Nav */}
            <nav aria-label="Main navigation" className="flex flex-col gap-1 px-3 flex-1">
              {navItems.map(({ icon: Icon, label, active, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] transition-colors',
                    active
                      ? 'text-accent-warm bg-accent-warm/8'
                      : 'text-text-muted/70 hover:text-accent-warm-hover hover:bg-bg-card/60'
                  )}
                >
                  <Icon className={cn('w-4 h-4 shrink-0 stroke-[1.5]', active && 'text-accent-warm')} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>

            {/* Settings */}
            <div className="border-t border-border-subtle px-3 py-3">
              <button
                onClick={() => { onSettingsClick(); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] text-text-muted/70 hover:text-text-primary hover:bg-bg-card/60 transition-colors"
              >
                <Settings className="w-4 h-4 shrink-0 stroke-[1.5]" />
                <span>Settings</span>
              </button>
            </div>
        </OverlaySurface>
      )}
    </>
  );
}
