import { useState, useEffect } from 'react';
import { X, Save, Clock, ListTodo, DollarSign, BookOpen, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import type { CalendarListEntry } from '@/types';
import type { LoadedSettings } from '@/types/electron';

type SettingsTab = 'day' | 'tasks' | 'money' | 'story' | 'privacy';

const TABS: { id: SettingsTab; label: string; icon: typeof Clock }[] = [
  { id: 'day', label: 'Day', icon: Clock },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'money', label: 'Money', icon: DollarSign },
  { id: 'story', label: 'Story', icon: BookOpen },
  { id: 'privacy', label: 'Privacy', icon: Shield },
];

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const [tab, setTab] = useState<SettingsTab>('day');
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

  // Integrations (from old settings)
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
  const [plaidClientId, setPlaidClientId] = useState('');
  const [plaidSecret, setPlaidSecret] = useState('');
  const [plaidClientIdDirty, setPlaidClientIdDirty] = useState(false);
  const [plaidSecretDirty, setPlaidSecretDirty] = useState(false);

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
      ...(plaidClientIdDirty && plaidClientId ? { plaidClientId } : {}),
      ...(plaidSecretDirty && plaidSecret ? { plaidSecret } : {}),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[640px] max-h-[85vh] bg-bg-card border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <h2 className="font-display italic text-[18px] font-light text-text-emphasis">Settings</h2>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-md transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border/50 px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-[12px] font-medium tracking-[0.06em] transition-colors border-b-2 -mb-[1px]',
                tab === t.id
                  ? 'border-accent-warm text-accent-warm'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6 hide-scrollbar">
          {tab === 'day' && (
            <>
              <Section title="Appearance">
                <Field label="Color mode">
                  <SegmentedControl
                    options={[
                      { value: 'light', label: 'Light' },
                      { value: 'dark', label: 'Dark' },
                    ]}
                    value={themeMode === 'focus' ? 'dark' : themeMode}
                    onChange={(v) => setThemeMode(v as 'light' | 'dark')}
                  />
                </Field>
              </Section>

              <Section title="Work Hours">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Day starts">
                    <input
                      type="time"
                      value={`${String(dayStartHour).padStart(2, '0')}:${String(dayStartMin).padStart(2, '0')}`}
                      onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); setDayStartHour(h); setDayStartMin(m); }}
                      className="input-field"
                    />
                  </Field>
                  <Field label="Day ends">
                    <input
                      type="time"
                      value={`${String(dayEndHour).padStart(2, '0')}:${String(dayEndMin).padStart(2, '0')}`}
                      onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); setDayEndHour(h); setDayEndMin(m); }}
                      className="input-field"
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Timebox Defaults">
                <Field label="Default block length">
                  <SegmentedControl
                    options={[
                      { value: 15, label: '15m' },
                      { value: 30, label: '30m' },
                      { value: 45, label: '45m' },
                      { value: 60, label: '60m' },
                    ]}
                    value={timeboxDefault}
                    onChange={(v) => setTimeboxDefault(v as number)}
                  />
                </Field>
              </Section>

              <Section title="Pomodoro">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Work (min)">
                    <input type="number" value={workMins} onChange={(e) => setWorkMins(Number(e.target.value))} className="input-field" />
                  </Field>
                  <Field label="Break (min)">
                    <input type="number" value={breakMins} onChange={(e) => setBreakMins(Number(e.target.value))} className="input-field" />
                  </Field>
                  <Field label="Long Break">
                    <input type="number" value={longBreakMins} onChange={(e) => setLongBreakMins(Number(e.target.value))} className="input-field" />
                  </Field>
                </div>
              </Section>

              <Section title="Quiet Focus — Blocked Sites">
                <textarea
                  value={blockedSites}
                  onChange={(e) => setBlockedSites(e.target.value)}
                  rows={4}
                  placeholder="reddit.com&#10;twitter.com&#10;youtube.com"
                  className="input-field resize-none font-mono text-[12px]"
                />
              </Section>

              <Section title="Sync">
                <Field label="Calendar sync frequency">
                  <SegmentedControl
                    options={[
                      { value: 1, label: '1m' },
                      { value: 2, label: '2m' },
                      { value: 5, label: '5m' },
                      { value: 15, label: '15m' },
                    ]}
                    value={syncFrequencyMins}
                    onChange={(v) => setSyncFrequencyMins(v as number)}
                  />
                </Field>
              </Section>

              <Section title="Integrations">
                <Field label="Anthropic API Key">
                  <input
                    type="password"
                    value={anthropicApiKey}
                    onChange={(e) => { setAnthropicApiKey(e.target.value); setAnthropicDirty(true); }}
                    placeholder={settings.anthropic.configured ? 'Saved key' : 'sk-ant-...'}
                    className="input-field"
                  />
                </Field>
                <Field label="Asana PAT">
                  <input
                    type="password"
                    value={asanaToken}
                    onChange={(e) => { setAsanaToken(e.target.value); setAsanaDirty(true); }}
                    placeholder={settings.asana.configured ? 'Saved token' : '0/abc123...'}
                    className="input-field"
                  />
                </Field>
                <Field label="Google Calendar Client ID">
                  <input value={gcalClientId} onChange={(e) => setGcalClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com" className="input-field" />
                </Field>
                <Field label="Google Calendar Secret">
                  <input
                    type="password"
                    value={gcalClientSecret}
                    onChange={(e) => { setGcalClientSecret(e.target.value); setGcalClientSecretDirty(true); }}
                    placeholder={settings.gcal.clientSecretConfigured ? 'Saved secret' : ''}
                    className="input-field"
                  />
                </Field>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGoogleAuth}
                    disabled={!gcalClientId || (!gcalClientSecret && !settings.gcal.clientSecretConfigured) || authenticating}
                    className={cn('settings-btn', authenticating && 'opacity-50 cursor-not-allowed')}
                  >
                    {authenticating ? 'Connecting...' : 'Connect Google'}
                  </button>
                  <button onClick={loadCalendars} disabled={loadingCalendars} className={cn('settings-btn', loadingCalendars && 'opacity-50')}>
                    {loadingCalendars ? 'Refreshing...' : 'Refresh calendars'}
                  </button>
                </div>
                {availableCalendars.length > 0 && (
                  <>
                    <Field label="Read calendars">
                      <div className="flex flex-col gap-2 rounded-lg border border-border p-3 bg-bg">
                        {availableCalendars.map((c) => (
                          <label key={c.id} className="flex items-center gap-3 text-[12px] text-text-primary">
                            <input type="checkbox" checked={gcalCalendarIds.includes(c.id)} onChange={() => toggleCalendar(c.id)} />
                            <span>{c.summary}{c.primary ? ' (primary)' : ''}</span>
                          </label>
                        ))}
                      </div>
                    </Field>
                    <Field label="Write focus blocks to">
                      <select value={gcalWriteCalendarId} onChange={(e) => setGcalWriteCalendarId(e.target.value)} className="input-field">
                        {availableCalendars
                          .filter((c) => gcalCalendarIds.includes(c.id) || c.id === gcalWriteCalendarId)
                          .map((c) => <option key={c.id} value={c.id}>{c.summary}</option>)}
                      </select>
                    </Field>
                  </>
                )}
              </Section>
            </>
          )}

          {tab === 'tasks' && (
            <>
              <Section title="Priority Rules">
                <Field label="Optimize schedule for">
                  <SegmentedControl
                    options={[
                      { value: 'deadlines', label: 'Deadlines' },
                      { value: 'energy', label: 'Energy' },
                      { value: 'revenue', label: 'Revenue' },
                      { value: 'balanced', label: 'Balanced' },
                    ]}
                    value={priorityRule}
                    onChange={(v) => setPriorityRule(v as string)}
                  />
                </Field>
              </Section>

              <Section title="ADHD-Friendly Controls">
                <Field label="Notification intensity">
                  <SegmentedControl
                    options={[
                      { value: 'minimal', label: 'Minimal' },
                      { value: 'standard', label: 'Standard' },
                      { value: 'high', label: 'High Support' },
                    ]}
                    value={notificationIntensity}
                    onChange={(v) => setNotificationIntensity(v as string)}
                  />
                </Field>
                <Field label="Distraction filtering">
                  <SegmentedControl
                    options={[
                      { value: 'show_all', label: 'Show All' },
                      { value: 'top_priorities', label: 'Top 3' },
                      { value: 'today_only', label: 'Today Only' },
                    ]}
                    value={distractionFiltering}
                    onChange={(v) => setDistractionFiltering(v as string)}
                  />
                </Field>
                <ComingSoon label="Nudge type — passive prompts vs active alerts" />
                <ComingSoon label="Task-initiation help — auto-break first task into tiny steps" />
                <ComingSoon label="Focus mode windows — scheduled deep-work periods" />
                <ComingSoon label="Lead-gen reminder frequency" />
              </Section>
            </>
          )}

          {tab === 'money' && (
            <>
              <Section title="Plaid Connection">
                <div className="rounded-lg border border-border bg-bg px-4 py-3 text-[12px] text-text-muted">
                  {settings.finance.configured ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between"><span>Institution</span><span className="font-mono text-text-primary">{settings.finance.institutionName || '—'}</span></div>
                      <div className="flex items-center justify-between"><span>Last sync</span><span className="font-mono text-text-primary">{settings.finance.lastSync || '—'}</span></div>
                    </div>
                  ) : <span>Not connected</span>}
                </div>
                <Field label="Plaid Client ID">
                  <div className="relative">
                    <input value={plaidClientId} onChange={(e) => { setPlaidClientId(e.target.value); setPlaidClientIdDirty(true); }} placeholder={settings.finance.plaidClientIdConfigured ? '' : 'client_id...'} className="input-field" />
                    {settings.finance.plaidClientIdConfigured && !plaidClientId && <ConfiguredBadge />}
                  </div>
                </Field>
                <Field label="Plaid Secret">
                  <input type="password" value={plaidSecret} onChange={(e) => { setPlaidSecret(e.target.value); setPlaidSecretDirty(true); }} placeholder={settings.finance.plaidSecretConfigured ? 'Saved secret' : ''} className="input-field" />
                </Field>
              </Section>

              <Section title="Financial Awareness">
                <Field label="Due-date window">
                  <SegmentedControl
                    options={[
                      { value: 1, label: '1 day' },
                      { value: 3, label: '3 days' },
                      { value: 7, label: '7 days' },
                      { value: 14, label: '14 days' },
                    ]}
                    value={dueDateWindowDays}
                    onChange={(v) => setDueDateWindowDays(v as number)}
                  />
                </Field>
                <Field label="Cash-flow time horizon">
                  <SegmentedControl
                    options={[
                      { value: 1, label: '24h' },
                      { value: 3, label: '3 days' },
                      { value: 7, label: '7 days' },
                      { value: 14, label: '14 days' },
                    ]}
                    value={timeHorizonDays}
                    onChange={(v) => setTimeHorizonDays(v as number)}
                  />
                </Field>
                <Field label="Alert severity">
                  <SegmentedControl
                    options={[
                      { value: 'quiet', label: 'Quiet Flag' },
                      { value: 'warning', label: 'Warning' },
                      { value: 'urgent', label: 'Urgent' },
                    ]}
                    value={alertSeverity}
                    onChange={(v) => setAlertSeverity(v as string)}
                  />
                </Field>
                <Field label="Coverage check sensitivity">
                  <SegmentedControl
                    options={[
                      { value: 'soft', label: 'Soft — warn if tight' },
                      { value: 'hard', label: 'Hard — flag anything borderline' },
                    ]}
                    value={financialSensitivity}
                    onChange={(v) => setFinancialSensitivity(v as string)}
                  />
                </Field>
              </Section>

              <Section title="Coming Soon">
                <ComingSoon label="Financial sources toggle — bills, invoices, balances separately" />
                <ComingSoon label="Client payment source — Stripe, Dubsado, or manual" />
                <ComingSoon label="Money-narrative mode — risk vs opportunity framing" />
              </Section>
            </>
          )}

          {tab === 'story' && (
            <>
              <Section title="Narrative Style">
                <Field label="How Ink tells your story">
                  <SegmentedControl
                    options={[
                      { value: 'concise', label: 'Concise' },
                      { value: 'practical', label: 'Practical' },
                      { value: 'reflective', label: 'Reflective' },
                      { value: 'screenwriter', label: 'Beat Sheet' },
                    ]}
                    value={narrativeStyle}
                    onChange={(v) => setNarrativeStyle(v as string)}
                  />
                </Field>
                <Field label="Story depth">
                  <SegmentedControl
                    options={[
                      { value: 'summary', label: 'Summary' },
                      { value: 'chapters', label: 'Chapters' },
                      { value: 'full', label: 'Full Recap' },
                    ]}
                    value={storyDepth}
                    onChange={(v) => setStoryDepth(v as string)}
                  />
                </Field>
              </Section>

              <Section title="Tone & Accountability">
                <Field label="Tone">
                  <SegmentedControl
                    options={[
                      { value: 'direct', label: 'Direct' },
                      { value: 'encouraging', label: 'Encouraging' },
                      { value: 'blunt', label: 'Blunt' },
                      { value: 'coach', label: 'Coach' },
                    ]}
                    value={tone}
                    onChange={(v) => setTone(v as string)}
                  />
                </Field>
                <Field label="Accountability level">
                  <SegmentedControl
                    options={[
                      { value: 'gentle', label: 'Gentle' },
                      { value: 'firm', label: 'Firm' },
                      { value: 'blunt', label: 'Tell me what I\'m avoiding' },
                    ]}
                    value={accountabilityLevel}
                    onChange={(v) => setAccountabilityLevel(v as string)}
                  />
                </Field>
              </Section>

              <Section title="Coming Soon">
                <ComingSoon label="Morning vs evening output — different formats for plan vs recap" />
                <ComingSoon label="Energy level input — shape the day based on how you feel" />
                <ComingSoon label="Work context — solo creator, client services, agency, hybrid" />
                <ComingSoon label="Creativity slider — literal schedule vs personality and metaphors" />
                <ComingSoon label="Action vs reflection bias" />
              </Section>
            </>
          )}

          {tab === 'privacy' && (
            <>
              <Section title="Data Protection">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-[13px] text-text-primary">Mask sensitive financial data</p>
                    <p className="text-[11px] text-text-muted mt-0.5">Hide full account numbers, show only last four digits</p>
                  </div>
                  <Toggle checked={sensitiveDataMasking} onChange={setSensitiveDataMasking} />
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-[13px] text-text-primary">Audit log</p>
                    <p className="text-[11px] text-text-muted mt-0.5">Track what changed and why Ink made a recommendation</p>
                  </div>
                  <Toggle checked={auditLog} onChange={setAuditLog} />
                </div>
              </Section>

              <Section title="Coming Soon">
                <ComingSoon label="Data visibility toggles — task, calendar, finance, client views" />
                <ComingSoon label="Memory depth — how far back Ink remembers patterns" />
                <ComingSoon label="Feedback loop — learn from helpful/not-helpful ratings" />
                <ComingSoon label="Export & delete controls" />
              </Section>

              <Section title="About">
                <div className="rounded-lg border border-border bg-bg px-4 py-3 text-[12px] text-text-muted">
                  <div className="flex items-center justify-between gap-4">
                    <span>Version</span>
                    <span className="font-mono text-text-primary">{settings.app.version || 'Unknown'}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-4">
                    <span>Build date</span>
                    <span className="font-mono text-text-primary">
                      {settings.app.buildDate
                        ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(settings.app.buildDate))
                        : 'Unavailable'}
                    </span>
                  </div>
                </div>
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-colors',
              'bg-accent-warm text-white hover:bg-accent-warm/90',
              saving && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Shared components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[11px] uppercase tracking-widest font-semibold text-text-muted">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] text-text-muted font-medium">{label}</label>
      {children}
    </div>
  );
}

function SegmentedControl({ options, value, onChange }: {
  options: Array<{ value: string | number; label: string }>;
  value: string | number;
  onChange: (value: string | number) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-bg p-1 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap',
            value === opt.value
              ? 'bg-bg-elevated text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-primary'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-10 h-5 rounded-full transition-colors',
        checked ? 'bg-accent-warm' : 'bg-border'
      )}
    >
      <div
        className={cn(
          'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 opacity-40">
      <div className="w-2 h-2 rounded-full bg-border shrink-0" />
      <span className="text-[12px] text-text-muted">{label}</span>
    </div>
  );
}

function ConfiguredBadge() {
  return (
    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded bg-bg-elevated text-text-muted">
      configured
    </span>
  );
}
