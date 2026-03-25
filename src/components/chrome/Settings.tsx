import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import type { CalendarListEntry } from '@/types';
import type { LoadedSettings } from '@/types/electron';
import { DayView } from './settings/DayView';
import { TasksView } from './settings/TasksView';
import { MoneyView } from './settings/MoneyView';
import { StoryView } from './settings/StoryView';
import { PrivacyView } from './settings/PrivacyView';
import { ConnectView } from './settings/ConnectView';

type SettingsTab = 'Day' | 'Tasks' | 'Money' | 'Story' | 'Privacy' | 'Connect';

const NAV: { num: string; id: SettingsTab; label: string }[] = [
  { num: '01', id: 'Day', label: 'Day' },
  { num: '02', id: 'Tasks', label: 'Tasks' },
  { num: '03', id: 'Money', label: 'Money' },
  { num: '04', id: 'Story', label: 'Story' },
  { num: '05', id: 'Privacy', label: 'Privacy' },
  { num: '06', id: 'Connect', label: 'Connect' },
];

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const [tab, setTab] = useState<SettingsTab>('Day');
  const [settings, setSettings] = useState<LoadedSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  // Day
  const [dayStartHour, setDayStartHour] = useState(9);
  const [dayStartMin, setDayStartMin] = useState(0);
  const [dayEndHour, setDayEndHour] = useState(18);
  const [dayEndMin, setDayEndMin] = useState(0);
  const [timeboxDefault, setTimeboxDefault] = useState(60);
  const [syncFrequencyMins, setSyncFrequencyMins] = useState(2);
  const [workMins, setWorkMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const [longBreakMins, setLongBreakMins] = useState(15);
  const [blockedSites, setBlockedSites] = useState('');

  // Tasks
  const [priorityRule, setPriorityRule] = useState('balanced');
  const [notificationIntensity, setNotificationIntensity] = useState('standard');
  const [distractionFiltering, setDistractionFiltering] = useState('show_all');

  // Money
  const [dueDateWindowDays, setDueDateWindowDays] = useState(7);
  const [alertSeverity, setAlertSeverity] = useState('warning');
  const [financialSensitivity, setFinancialSensitivity] = useState('soft');
  const [timeHorizonDays, setTimeHorizonDays] = useState(7);

  // Story / AI
  const [narrativeStyle, setNarrativeStyle] = useState('practical');
  const [storyDepth, setStoryDepth] = useState('summary');
  const [tone, setTone] = useState('direct');
  const [accountabilityLevel, setAccountabilityLevel] = useState('firm');

  // Privacy
  const [sensitiveDataMasking, setSensitiveDataMasking] = useState(false);
  const [auditLog, setAuditLog] = useState(false);

  // Integrations
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [anthropicDirty, setAnthropicDirty] = useState(false);
  const [asanaToken, setAsanaToken] = useState('');
  const [asanaDirty, setAsanaDirty] = useState(false);
  const [gcalClientId, setGcalClientId] = useState('');
  const [gcalClientSecret, setGcalClientSecret] = useState('');
  const [gcalClientSecretDirty, setGcalClientSecretDirty] = useState(false);
  const [gcalCalendarIds, setGcalCalendarIds] = useState<string[]>(['primary']);
  const [gcalWriteCalendarId, setGcalWriteCalendarId] = useState('primary');
  const [availableCalendars, setAvailableCalendars] = useState<Array<{ id: string; summary: string; primary?: boolean }>>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeSecretKeyDirty, setStripeSecretKeyDirty] = useState(false);

  async function loadCalendars() {
    setLoadingCalendars(true);
    const result = await window.api.gcal.listCalendars();
    if (result.success && result.data) {
      const calendars = result.data.map((c: CalendarListEntry) => ({ id: c.id, summary: c.summary, primary: c.primary }));
      const todayId = calendars.find((c) => c.summary.trim().toLowerCase() === 'today')?.id;
      setAvailableCalendars(calendars);
      setGcalCalendarIds((prev) => {
        const valid = prev.filter((id) => calendars.some((c) => c.id === id));
        if (todayId && (valid.length === 0 || (valid.length === 1 && valid[0] === 'primary'))) return [todayId];
        return valid.length > 0 ? valid : [todayId || calendars[0]?.id || 'primary'];
      });
      setGcalWriteCalendarId((prev) => {
        if (todayId && (!prev || prev === 'primary')) return todayId;
        return calendars.some((c) => c.id === prev) ? prev : todayId || calendars[0]?.id || 'primary';
      });
    }
    setLoadingCalendars(false);
  }

  useEffect(() => {
    async function load() {
      const s = await window.api.settings.load();
      setSettings(s);
      // Day
      setDayStartHour(s.day.startHour);
      setDayStartMin(s.day.startMin);
      setDayEndHour(s.day.endHour);
      setDayEndMin(s.day.endMin);
      setTimeboxDefault(s.day.timeboxDefault);
      setSyncFrequencyMins(s.day.syncFrequencyMins);
      setWorkMins(s.pomodoro.workMins);
      setBreakMins(s.pomodoro.breakMins);
      setLongBreakMins(s.pomodoro.longBreakMins);
      setBlockedSites(s.focus.blockedSites.join('\n'));
      // Tasks
      setPriorityRule(s.tasks.priorityRule);
      setNotificationIntensity(s.tasks.notificationIntensity);
      setDistractionFiltering(s.tasks.distractionFiltering);
      // Money
      setDueDateWindowDays(s.moneyPrefs.dueDateWindowDays);
      setAlertSeverity(s.moneyPrefs.alertSeverity);
      setFinancialSensitivity(s.moneyPrefs.financialSensitivity);
      setTimeHorizonDays(s.moneyPrefs.timeHorizonDays);
      // Story
      setNarrativeStyle(s.story.narrativeStyle);
      setStoryDepth(s.story.storyDepth);
      setTone(s.story.tone);
      setAccountabilityLevel(s.story.accountabilityLevel);
      // Privacy
      setSensitiveDataMasking(s.privacy.sensitiveDataMasking);
      setAuditLog(s.privacy.auditLog);
      // Integrations
      setGcalClientId(s.gcal.clientId);
      if (s.gcal.calendarIds.length > 0) setGcalCalendarIds(s.gcal.calendarIds);
      if (s.gcal.writeCalendarId) setGcalWriteCalendarId(s.gcal.writeCalendarId);
      if (s.gcal.clientId && s.gcal.clientSecretConfigured) await loadCalendars();
    }
    void load();
  }, []);

  useEffect(() => {
    if (!gcalCalendarIds.includes(gcalWriteCalendarId)) {
      setGcalWriteCalendarId(gcalCalendarIds[0] || 'primary');
    }
  }, [gcalCalendarIds, gcalWriteCalendarId]);

  function toggleCalendar(calendarId: string) {
    setGcalCalendarIds((prev) => {
      if (prev.includes(calendarId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== calendarId);
      }
      return [...prev, calendarId];
    });
  }

  async function handleGoogleAuth() {
    setAuthenticating(true);
    await window.api.settings.save({ gcalClientId, ...(gcalClientSecretDirty ? { gcalClientSecret } : {}) });
    const result = await window.api.gcal.auth();
    if (result.success) await loadCalendars();
    setAuthenticating(false);
  }

  async function handleSave() {
    setSaving(true);
    const calendarIds = gcalCalendarIds.length > 0 ? gcalCalendarIds : ['primary'];
    const writeCalendarId = gcalWriteCalendarId || calendarIds[0] || 'primary';
    await window.api.settings.save({
      // Integrations
      ...(anthropicDirty ? { anthropicApiKey } : {}),
      ...(asanaDirty ? { asanaToken } : {}),
      gcalClientId,
      ...(gcalClientSecretDirty ? { gcalClientSecret } : {}),
      gcalCalendarIds: calendarIds,
      gcalWriteCalendarId: writeCalendarId,
      ...(stripeSecretKeyDirty ? { stripeSecretKey } : {}),
      // Day
      dayStartHour, dayStartMin, dayEndHour, dayEndMin, timeboxDefault, syncFrequencyMins,
      workMins, breakMins, longBreakMins,
      blockedSites: blockedSites.split('\n').map((s) => s.trim()).filter(Boolean),
      // Tasks
      priorityRule, notificationIntensity, distractionFiltering,
      // Money
      dueDateWindowDays, alertSeverity, financialSensitivity, timeHorizonDays,
      // Story
      narrativeStyle, storyDepth, tone, accountabilityLevel,
      // Privacy
      sensitiveDataMasking, auditLog,
    });
    setSaving(false);
    onClose();
  }

  if (!settings) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]">
      <div className="absolute inset-4 md:inset-8 lg:inset-12 bg-[#0E0E0E]/95 backdrop-blur-2xl border border-white/[0.04] rounded-[2px] shadow-2xl flex flex-col md:flex-row overflow-hidden text-white font-sans selection:bg-accent-warm/30 selection:text-accent-warm">

        {/* Subtle grain overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDIiLz4KPC9zdmc+')] opacity-20 pointer-events-none mix-blend-overlay z-0" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-8 right-8 z-50 p-2 text-white/30 hover:text-white/90 transition-colors bg-transparent border border-transparent hover:border-white/10 rounded-full"
        >
          <X size={20} strokeWidth={1} />
        </button>

        {/* Left Navigation */}
        <aside className="w-full md:w-[320px] lg:w-[400px] border-b md:border-b-0 md:border-r border-solid border-white/[0.04] flex flex-col z-10 relative">
          <div className="p-12 pb-8">
            <h1 className="text-sm tracking-[0.3em] font-medium text-white/30 uppercase">
              Preferences
            </h1>
          </div>

          <nav className="flex-1 px-8 py-4 overflow-y-auto" aria-label="Settings sections">
            <ul role="tablist" aria-orientation="vertical" className="flex flex-col gap-2">
              {NAV.map((item) => {
                const isActive = tab === item.id;
                return (
                  <li key={item.id} role="presentation">
                    <button
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`settings-panel-${item.id}`}
                      id={`settings-tab-${item.id}`}
                      onClick={() => setTab(item.id)}
                      className="w-full group flex items-baseline gap-6 px-4 py-4 text-left focus:outline-none"
                    >
                      <span className={`text-[10px] font-mono mt-1.5 transition-colors duration-500 ${
                        isActive ? 'text-accent-warm' : 'text-white/20 group-hover:text-white/40'
                      }`}>
                        {item.num}
                      </span>
                      <span className={`text-2xl md:text-3xl transition-all duration-500 font-serif ${
                        isActive
                          ? 'text-white/90 italic'
                          : 'text-white/30 group-hover:text-white/60'
                      }`}>
                        {item.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Save button in sidebar footer */}
          <div className="px-12 py-8 border-t border-white/[0.04]">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-3 px-6 py-3 bg-transparent border border-accent-warm/40 text-accent-warm text-[12px] tracking-wide uppercase hover:bg-accent-warm/5 hover:border-accent-warm/60 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={14} strokeWidth={1.5} />
              {saving ? 'Saving...' : 'Save & Close'}
            </button>
          </div>

          {/* Decorative corner accent */}
          <div className="absolute bottom-28 left-12 w-8 h-px bg-white/10" />
        </aside>

        {/* Main Content */}
        <main
          role="tabpanel"
          id={`settings-panel-${tab}`}
          aria-labelledby={`settings-tab-${tab}`}
          className="flex-1 overflow-y-auto z-10 relative"
        >
          <div className="px-8 py-12 md:px-16 md:py-16 lg:px-24 lg:py-20 max-w-[1200px] mx-auto min-h-full">
            {tab === 'Day' && (
              <DayView
                themeMode={themeMode}
                setThemeMode={setThemeMode}
                dayStartHour={dayStartHour}
                dayStartMin={dayStartMin}
                dayEndHour={dayEndHour}
                dayEndMin={dayEndMin}
                setDayStartHour={setDayStartHour}
                setDayStartMin={setDayStartMin}
                setDayEndHour={setDayEndHour}
                setDayEndMin={setDayEndMin}
                timeboxDefault={timeboxDefault}
                setTimeboxDefault={setTimeboxDefault}
                syncFrequencyMins={syncFrequencyMins}
                setSyncFrequencyMins={setSyncFrequencyMins}
                workMins={workMins}
                breakMins={breakMins}
                longBreakMins={longBreakMins}
                setWorkMins={setWorkMins}
                setBreakMins={setBreakMins}
                setLongBreakMins={setLongBreakMins}
                blockedSites={blockedSites}
                setBlockedSites={setBlockedSites}
              />
            )}
            {tab === 'Tasks' && (
              <TasksView
                priorityRule={priorityRule}
                setPriorityRule={setPriorityRule}
                notificationIntensity={notificationIntensity}
                setNotificationIntensity={setNotificationIntensity}
                distractionFiltering={distractionFiltering}
                setDistractionFiltering={setDistractionFiltering}
              />
            )}
            {tab === 'Money' && (
              <MoneyView
                settings={settings}
                stripeSecretKey={stripeSecretKey}
                setStripeSecretKey={setStripeSecretKey}
                setStripeSecretKeyDirty={setStripeSecretKeyDirty}
                dueDateWindowDays={dueDateWindowDays}
                setDueDateWindowDays={setDueDateWindowDays}
                alertSeverity={alertSeverity}
                setAlertSeverity={setAlertSeverity}
                financialSensitivity={financialSensitivity}
                setFinancialSensitivity={setFinancialSensitivity}
                timeHorizonDays={timeHorizonDays}
                setTimeHorizonDays={setTimeHorizonDays}
              />
            )}
            {tab === 'Story' && (
              <StoryView
                narrativeStyle={narrativeStyle}
                setNarrativeStyle={setNarrativeStyle}
                storyDepth={storyDepth}
                setStoryDepth={setStoryDepth}
                tone={tone}
                setTone={setTone}
                accountabilityLevel={accountabilityLevel}
                setAccountabilityLevel={setAccountabilityLevel}
              />
            )}
            {tab === 'Privacy' && (
              <PrivacyView
                settings={settings}
                sensitiveDataMasking={sensitiveDataMasking}
                setSensitiveDataMasking={setSensitiveDataMasking}
                auditLog={auditLog}
                setAuditLog={setAuditLog}
              />
            )}
            {tab === 'Connect' && (
              <ConnectView
                settings={settings}
                anthropicApiKey={anthropicApiKey}
                setAnthropicApiKey={setAnthropicApiKey}
                setAnthropicDirty={setAnthropicDirty}
                asanaToken={asanaToken}
                setAsanaToken={setAsanaToken}
                setAsanaDirty={setAsanaDirty}
                gcalClientId={gcalClientId}
                setGcalClientId={setGcalClientId}
                gcalClientSecret={gcalClientSecret}
                setGcalClientSecret={setGcalClientSecret}
                setGcalClientSecretDirty={setGcalClientSecretDirty}
                gcalCalendarIds={gcalCalendarIds}
                toggleCalendar={toggleCalendar}
                gcalWriteCalendarId={gcalWriteCalendarId}
                setGcalWriteCalendarId={setGcalWriteCalendarId}
                availableCalendars={availableCalendars}
                loadingCalendars={loadingCalendars}
                authenticating={authenticating}
                handleGoogleAuth={handleGoogleAuth}
                loadCalendars={loadCalendars}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
