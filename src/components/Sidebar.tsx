import {
  Target,
  LayoutGrid,
  Archive,
  Settings,
  Moon,
  Sun,
  Flame,
  CalendarClock,
  CheckCircle2,
  Circle,
  ChevronsLeft,
  ChevronsRight,
  Sunrise,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { AppMark, AsanaIcon, GCalIcon, GmailIcon } from './AppIcons';

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, active, collapsed, onClick }: NavItemProps) {
  const { isLight, isFocus } = useTheme();

  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        'no-drag w-full flex items-center rounded-md text-[13px] transition-all duration-300',
        collapsed ? 'justify-center px-2.5 py-2' : 'gap-3 px-3 py-1.5',
        active
          ? isLight
            ? 'bg-bg-card shadow-sm text-text-emphasis font-medium shadow-[inset_3px_0_0_var(--color-accent-warm)]'
            : isFocus
              ? 'bg-bg-elevated text-text-primary font-medium'
              : 'bg-white/10 text-text-emphasis font-medium shadow-[inset_3px_0_0_var(--color-accent-warm)]'
          : 'text-text-muted/70 hover:text-text-primary hover:bg-bg-card/60'
      )}
    >
      <Icon className={cn('w-4 h-4 stroke-[1.5]', active ? 'text-accent-warm' : '', collapsed && active && 'scale-110')} />
      {!collapsed && label}
    </button>
  );
}

function ThemeSwitcher({ collapsed }: { collapsed: boolean }) {
  const { mode, setMode } = useTheme();

  const modes: { value: ThemeMode; icon: React.ElementType }[] = [
    { value: 'dark', icon: Moon },
    { value: 'light', icon: Sun },
    { value: 'focus', icon: Flame },
  ];

  return (
    <div className={cn('flex items-center gap-1 p-1 rounded-lg bg-bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]', collapsed && 'justify-center')}>
      {modes.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setMode(value)}
          className={cn(
            'no-drag p-1.5 rounded-md transition-all duration-300',
            mode === value
              ? 'bg-bg-elevated text-text-emphasis shadow-sm'
              : 'text-text-muted hover:text-text-primary'
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
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function RitualsStrip() {
  const { rituals, toggleRitualComplete } = useApp();
  if (rituals.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="pt-4 pb-2">
      <div className="mb-2 px-3">
        <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-medium">
          Daily Rituals
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {rituals.map((ritual) => {
          const done = ritual.completedDates.includes(today);
          return (
            <button
              key={ritual.id}
              onClick={() => toggleRitualComplete(ritual.id)}
              className="no-drag w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12px] text-text-muted hover:text-text-primary hover:bg-bg-card/60 transition-all text-left"
            >
              {done ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-done shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className={cn('leading-snug', done && 'line-through opacity-60')}>{ritual.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar({ onSettingsClick, onShowBriefing, collapsed, onToggleCollapse }: SidebarProps) {
  const { isLight } = useTheme();
  const { activeView, setActiveView, activeSource, setActiveSource, openWeeklyPlanning } = useApp();

  return (
    <aside className={cn('focus-dim utility-rail paper-texture column-divider relative flex flex-col h-full shrink-0 transition-[width,opacity,border-width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] backdrop-blur-xl shadow-[24px_0_60px_rgba(0,0,0,0.22)]', collapsed ? 'w-[84px]' : 'w-[228px]')}>
      <button
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'no-drag absolute top-3 z-[90] rounded-full border backdrop-blur-md transition-all duration-200 ease-out hover:text-text-primary hover:scale-[1.03] active:scale-[0.98]',
          isLight
            ? 'border-stone-300/70 bg-white/86 text-stone-500 hover:border-stone-400/80'
            : 'border-border-subtle bg-bg-elevated/82 text-text-muted hover:border-border',
          collapsed ? 'left-1/2 -translate-x-1/2 p-2' : 'right-4 p-2'
        )}
      >
        {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
      </button>

      <div className={cn('drag-region flex items-center pt-10 pb-6 transition-all duration-300', collapsed ? 'justify-center px-3 pt-14' : 'gap-3 px-5')}>
        <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 bg-white/5 shadow-[0_12px_24px_rgba(0,0,0,0.22)]">
          <AppMark className="w-full h-full object-cover" />
        </div>
        {!collapsed && (
          <span className="font-display italic text-[15px] font-light tracking-wide text-text-emphasis transition-all duration-300">
            TimeFocus
          </span>
        )}
      </div>

      <nav className={cn('flex-1 py-2 flex flex-col gap-1 overflow-y-auto hide-scrollbar', collapsed ? 'px-3' : 'px-3')}>
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
              collapsed ? 'justify-center px-2.5 py-2' : 'gap-3 px-3 py-1.5'
            )}
          >
            <Sunrise className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && 'Morning Briefing'}
          </button>
          <button
            onClick={openWeeklyPlanning}
            title={collapsed ? 'Plan Week' : undefined}
            className={cn(
              'no-drag w-full flex items-center rounded-md text-[12px] text-text-muted hover:text-text-primary hover:bg-bg-card/60 transition-all border border-dashed border-border-subtle',
              collapsed ? 'justify-center px-2.5 py-2' : 'gap-3 px-3 py-1.5'
            )}
          >
            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && 'Plan Week'}
          </button>
        </div>

        {!collapsed && <RitualsStrip />}

        {!collapsed && (
          <div className="mt-8 mb-2 px-3">
            <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-medium">
              Sources
            </span>
          </div>
        )}

        <NavItem icon={AsanaIcon} label="Asana" collapsed={collapsed} active={activeSource === 'asana'} onClick={() => setActiveSource(activeSource === 'asana' ? 'cover' : 'asana')} />
        <NavItem icon={GCalIcon} label="Google Calendar" collapsed={collapsed} active={activeSource === 'gcal'} onClick={() => setActiveSource(activeSource === 'gcal' ? 'cover' : 'gcal')} />
        <NavItem icon={GmailIcon} label="Gmail" collapsed={collapsed} active={activeSource === 'gmail'} onClick={() => setActiveSource(activeSource === 'gmail' ? 'cover' : 'gmail')} />
      </nav>

      <div className={cn('border-t border-border-subtle flex flex-col gap-2', collapsed ? 'p-3' : 'p-3')}>
        <div className={cn(collapsed ? 'px-0 py-1 flex justify-center' : 'px-1 py-1')}>
          <ThemeSwitcher collapsed={collapsed} />
        </div>

        <NavItem icon={Settings} label="Settings" collapsed={collapsed} onClick={onSettingsClick} />

        {!collapsed && (
          <button className="no-drag flex items-center gap-3 w-full p-2 mt-1 rounded-lg hover:bg-bg-card transition-colors text-left group">
            <div className="w-7 h-7 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-[11px] font-medium text-text-primary">
              P
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium truncate text-text-primary group-hover:text-text-emphasis transition-colors">
                Patrick
              </div>
              <div className="text-[10px] text-emerald-500 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Connected
              </div>
            </div>
          </button>
        )}
      </div>
    </aside>
  );
}
