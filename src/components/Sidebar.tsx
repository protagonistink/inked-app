import {
  Target,
  LayoutGrid,
  Archive,
  Settings,
  Moon,
  Sun,
  Flame,
  CalendarClock,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Sunrise,
  MoonStar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { InkedLogo } from './InkedLogo';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, active, collapsed, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        'no-drag w-full flex items-center rounded-md text-[13px] transition-all duration-300',
        collapsed ? 'justify-center px-1 py-2' : 'gap-3 px-3 py-1.5',
        active
          ? 'text-accent-warm font-medium'
          : 'text-text-muted/70 hover:text-text-primary hover:bg-bg-card/60'
      )}
    >
      <Icon className={cn('w-4 h-4 stroke-[1.5] shrink-0', active ? 'text-accent-warm' : '', collapsed && active && 'scale-110')} />
      <span className={cn('transition-opacity duration-150 whitespace-nowrap overflow-hidden', collapsed ? 'opacity-0 w-0' : 'opacity-100')}>{label}</span>
    </button>
  );
}

function ThemeSwitcher({ collapsed }: { collapsed: boolean }) {
  const { mode, setMode } = useTheme();
  const { lockDay, unlockDay, dayLocked } = useApp();

  const modes: { value: ThemeMode; icon: React.ElementType }[] = [
    { value: 'dark', icon: Moon },
    { value: 'light', icon: Sun },
    { value: 'focus', icon: Flame },
  ];

  function handleModeClick(value: ThemeMode) {
    if (value === 'focus') {
      if (dayLocked) {
        unlockDay();
        setMode('dark');
      } else {
        lockDay();
        setMode('focus');
      }
    } else {
      if (dayLocked) unlockDay();
      setMode(value);
    }
  }

  return (
    <div
      className={cn(
        'flex gap-3',
        collapsed ? 'flex-col items-center justify-center' : 'items-center'
      )}
    >
      {modes.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => handleModeClick(value)}
          className={cn(
            'no-drag p-1 transition-all duration-300',
            (mode === value || (value === 'focus' && dayLocked))
              ? 'text-accent-warm/80'
              : 'text-text-muted/40 hover:text-text-muted/70'
          )}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}

interface SidebarProps {
  onSettingsClick?: () => void;
  onShowBriefing?: () => void;
  onShowEveningReflection?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}


export function Sidebar({ onSettingsClick, onShowBriefing, onShowEveningReflection, collapsed, onToggleCollapse }: SidebarProps) {
  const { isLight } = useTheme();
  const { activeView, setActiveView, openWeeklyPlanning, openMonthlyPlanning } = useApp();

  return (
    <aside className={cn('focus-dim utility-rail paper-texture column-divider relative flex h-full shrink-0 flex-col transition-[width] duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]', collapsed ? 'w-14' : 'w-52')}>
      <div
        className={cn(
          'drag-region shrink-0 transition-all duration-300',
          collapsed
            ? 'flex min-h-[134px] items-end justify-center px-1 pt-[74px] pb-8'
            : 'flex min-h-[148px] items-end px-4 pt-[76px] pb-6'
        )}
      >
        <InkedLogo
          collapsed={collapsed}
          className={collapsed ? 'mx-auto h-[36px] w-[36px] p-0.5' : 'ml-5 w-full max-w-[170px]'}
        />
      </div>

      <nav
        className={cn(
          'flex flex-1 flex-col gap-1 overflow-y-auto hide-scrollbar pb-2',
          collapsed ? 'px-1.5 pt-28' : 'px-3 pt-40'
        )}
      >
        <NavItem
          icon={Target}
          label="Weekly Intentions"
          collapsed={collapsed}
          active={activeView === 'goals'}
          onClick={() => setActiveView('goals')}
        />
        <NavItem
          icon={LayoutGrid}
          label="Today's Commit"
          collapsed={collapsed}
          active={activeView === 'flow'}
          onClick={() => setActiveView('flow')}
        />
        <NavItem
          icon={Archive}
          label="Archive"
          collapsed={collapsed}
          active={activeView === 'archive'}
          onClick={() => setActiveView('archive')}
        />

        <div className="mt-4 flex flex-col gap-1">
          <button
            onClick={onShowBriefing}
            title={collapsed ? 'Morning Briefing' : undefined}
            className={cn(
              'no-drag w-full flex items-center rounded-md text-[12px] text-text-muted hover:text-accent-warm hover:bg-bg-card/60 transition-all border border-dashed border-border-subtle',
              collapsed ? 'justify-center px-1 py-2' : 'gap-3 px-3 py-1.5'
            )}
          >
            <Sunrise className="w-3.5 h-3.5 shrink-0" />
            <span className={cn('transition-opacity duration-150 whitespace-nowrap overflow-hidden', collapsed ? 'opacity-0 w-0' : 'opacity-100')}>Morning Briefing</span>
          </button>
          <button
            onClick={onShowEveningReflection}
            title={collapsed ? 'Evening Reflection' : undefined}
            className={cn(
              'no-drag w-full flex items-center rounded-md text-[12px] text-text-muted hover:text-accent-warm hover:bg-bg-card/60 transition-all border border-dashed border-border-subtle',
              collapsed ? 'justify-center px-1 py-2' : 'gap-3 px-3 py-1.5'
            )}
          >
            <MoonStar className="w-3.5 h-3.5 shrink-0" />
            <span className={cn('transition-opacity duration-150 whitespace-nowrap overflow-hidden', collapsed ? 'opacity-0 w-0' : 'opacity-100')}>Evening Reflection</span>
          </button>
          <button
            onClick={openWeeklyPlanning}
            title={collapsed ? 'Plan Week' : undefined}
            className={cn(
              'no-drag w-full flex items-center rounded-md text-[12px] text-text-muted hover:text-text-primary hover:bg-bg-card/60 transition-all border border-dashed border-border-subtle',
              collapsed ? 'justify-center px-1 py-2' : 'gap-3 px-3 py-1.5'
            )}
          >
            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
            <span className={cn('transition-opacity duration-150 whitespace-nowrap overflow-hidden', collapsed ? 'opacity-0 w-0' : 'opacity-100')}>Plan Week</span>
          </button>
          <button
            onClick={openMonthlyPlanning}
            title={collapsed ? 'Plan Month' : undefined}
            className={cn(
              'no-drag w-full flex items-center rounded-md text-[12px] text-text-muted hover:text-text-primary hover:bg-bg-card/60 transition-all border border-dashed border-border-subtle',
              collapsed ? 'justify-center px-1 py-2' : 'gap-3 px-3 py-1.5'
            )}
          >
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            <span className={cn('transition-opacity duration-150 whitespace-nowrap overflow-hidden', collapsed ? 'opacity-0 w-0' : 'opacity-100')}>Plan Month</span>
          </button>
        </div>

      </nav>

      <div className={cn('border-t border-border-subtle flex flex-col gap-2', collapsed ? 'p-3' : 'p-3')}>
        <div className={cn(collapsed ? 'px-0 py-1 flex justify-center' : 'px-1 py-1')}>
          <ThemeSwitcher collapsed={collapsed} />
        </div>

        <NavItem icon={Settings} label="Settings" collapsed={collapsed} onClick={onSettingsClick} />

        {!collapsed ? (
          <div className="flex items-center justify-between gap-1 mt-1 px-1.5">
            <button className="no-drag flex items-center gap-3 flex-1 min-w-0 px-2.5 py-1.5 rounded-lg hover:bg-bg-card transition-colors text-left group">
              <div className="w-6 h-6 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-[10px] display-font font-medium text-text-primary shrink-0">
                P
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="text-[12px] font-medium leading-none truncate text-text-primary group-hover:text-text-emphasis transition-colors">
                  Patrick
                </div>
                <div className="text-[9px] uppercase tracking-wider text-accent-warm/80 flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-warm/80" />
                  Connected
                </div>
              </div>
            </button>
            <button
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              className={cn(
                'no-drag shrink-0 p-1.5 mr-1 rounded-md transition-all duration-200 ease-out hover:scale-[1.03] active:scale-[0.98]',
                isLight
                  ? 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-card'
              )}
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onToggleCollapse}
            title="Expand sidebar"
            className={cn(
              'no-drag flex items-center justify-center w-full py-2 rounded-lg transition-all duration-200 ease-out hover:scale-[1.03] active:scale-[0.98]',
              isLight
                ? 'text-stone-400 hover:text-stone-600 hover:bg-stone-100'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-card'
            )}
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
