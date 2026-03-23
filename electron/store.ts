import fs from 'node:fs';
import path from 'node:path';
import { app, ipcMain } from 'electron';
import Store from 'electron-store';
import { getSecure, setSecure } from './secure-store';

const store = new Store({
  defaults: {
    anthropic: { apiKey: '' },
    asana: { token: '' },
    gcal: {
      clientId: '',
      clientSecret: '',
      calendarId: 'primary',
      calendarIds: ['primary'],
      writeCalendarId: 'primary',
    },
    pomodoro: { workMins: 25, breakMins: 5, longBreakMins: 15, longBreakInterval: 4 },
    focus: {
      blockedSites: [
        'reddit.com',
        'news.ycombinator.com',
        'twitter.com',
        'x.com',
        'youtube.com',
        'facebook.com',
        'instagram.com',
      ],
    },
    plannerState: {
      weeklyGoals: [],
      plannedTasks: [],
      dailyPlans: [],
      viewDate: '',
      dailyPlan: { date: '', committedTaskIds: [] },
    },
    userPhysics: {
      focusBlockLength: 90,
      peakEnergyWindow: '9am–12pm',
      commonDerailers: ['email rabbit holes', 'scope creep mid-task', 'unscheduled client requests'],
      planningStyle: 'needs explicit time boxes or tasks float; works best with 2–3 deep work anchors per day',
      recoveryPattern: '30 min context-switch cost between deep work modes; back-to-back meetings kill afternoon output',
      warningSignals: ['over-scheduling mornings leaving no buffer', 'no creative/writing block before noon', 'committing more than 5h of deep work on a meeting-heavy day'],
    },
    physicsLog: [] as Array<{
      date: string;
      source: string;
      observation: string;
      data?: Record<string, unknown>;
    }>,
    inkContext: {
      journalEntries: [] as Array<Record<string, unknown>>,
      lastUpdated: new Date().toISOString(),
    },
    scratch: {
      entries: [] as Array<{ id: string; text: string; createdAt: string }>,
    },
    plaid: {
      clientId: '',
      secret: '',
      accessToken: '',
      itemId: '',
      institutionName: '',
      lastSync: '',
    },
    finance: {
      configured: false,
      weeklyPattern: [] as number[],
    },
    financeConfig: {
      flexPoolTarget: 0,
      survivalNeeds: 0,
      untouchableNeeds: 0,
    },
    // User preferences
    userPrefs: {
      day: { startHour: 9, startMin: 0, endHour: 18, endMin: 0, timeboxDefault: 60, syncFrequencyMins: 2 },
      story: { narrativeStyle: 'practical', storyDepth: 'summary', tone: 'direct', accountabilityLevel: 'firm' },
      tasks: { priorityRule: 'balanced', notificationIntensity: 'standard', distractionFiltering: 'show_all' },
      privacy: { sensitiveDataMasking: false, auditLog: false },
      moneyPrefs: { dueDateWindowDays: 7, alertSeverity: 'warning', financialSensitivity: 'soft', timeHorizonDays: 7 },
    },
  },
});

const SAFE_STORE_KEYS = new Set([
  'plannerState',
  'dayLocked',
  'dayLockedDate',
  'monthlyPlanDismissedDate',
  'startOfDay.shownDate',
  'endOfDay.shownDate',
  'finance.configured',
]);

function isAllowedStoreKey(key: string) {
  return SAFE_STORE_KEYS.has(key) || key.startsWith('briefing.dismissed.');
}

export function registerStoreHandlers() {
  ipcMain.handle('store:get', (_event, key: string) => {
    if (!isAllowedStoreKey(key)) {
      throw new Error(`Renderer store access denied for key: ${key}`);
    }
    return store.get(key);
  });

  ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
    if (!isAllowedStoreKey(key)) {
      throw new Error(`Renderer store access denied for key: ${key}`);
    }
    store.set(key, value);
    return true;
  });

  ipcMain.handle('settings:load', () => {
    const gcal = (store.get('gcal') as Record<string, unknown> | undefined) ?? {};
    const pomodoro = (store.get('pomodoro') as Record<string, unknown> | undefined) ?? {};
    const focus = (store.get('focus') as Record<string, unknown> | undefined) ?? {};
    const prefs = (store.get('userPrefs') as Record<string, Record<string, unknown>> | undefined) ?? {};
    let buildDate: string | null = null;

    try {
      const buildArtifact = app.isPackaged
        ? process.execPath
        : path.join(app.getAppPath(), 'package.json');
      buildDate = fs.statSync(buildArtifact).mtime.toISOString();
    } catch (error) {
      console.warn('Failed to resolve build date:', error);
    }

    return {
      app: {
        version: app.getVersion(),
        buildDate,
      },
      anthropic: {
        configured: Boolean(store.get('anthropic.apiKey')),
      },
      asana: {
        configured: Boolean(store.get('asana.token')),
      },
      gcal: {
        clientId: String(gcal.clientId ?? ''),
        clientSecretConfigured: Boolean(gcal.clientSecret),
        calendarId: String(gcal.calendarId ?? 'primary'),
        calendarIds: Array.isArray(gcal.calendarIds) ? gcal.calendarIds : ['primary'],
        writeCalendarId: String(gcal.writeCalendarId ?? gcal.calendarId ?? 'primary'),
      },
      pomodoro: {
        workMins: Number(pomodoro.workMins ?? 25),
        breakMins: Number(pomodoro.breakMins ?? 5),
        longBreakMins: Number(pomodoro.longBreakMins ?? 15),
      },
      focus: {
        blockedSites: Array.isArray(focus.blockedSites) ? focus.blockedSites : [],
      },
      finance: {
        configured: Boolean(store.get('plaid.accessToken')),
        institutionName: String(store.get('plaid.institutionName') || ''),
        lastSync: String(store.get('plaid.lastSync') || ''),
        plaidClientIdConfigured: Boolean(store.get('plaid.clientId')),
        plaidSecretConfigured: Boolean(store.get('plaid.secret')),
      },
      day: {
        startHour: Number(prefs.day?.startHour ?? 9),
        startMin: Number(prefs.day?.startMin ?? 0),
        endHour: Number(prefs.day?.endHour ?? 18),
        endMin: Number(prefs.day?.endMin ?? 0),
        timeboxDefault: Number(prefs.day?.timeboxDefault ?? 60),
        syncFrequencyMins: Number(prefs.day?.syncFrequencyMins ?? 2),
      },
      story: {
        narrativeStyle: String(prefs.story?.narrativeStyle ?? 'practical'),
        storyDepth: String(prefs.story?.storyDepth ?? 'summary'),
        tone: String(prefs.story?.tone ?? 'direct'),
        accountabilityLevel: String(prefs.story?.accountabilityLevel ?? 'firm'),
      },
      tasks: {
        priorityRule: String(prefs.tasks?.priorityRule ?? 'balanced'),
        notificationIntensity: String(prefs.tasks?.notificationIntensity ?? 'standard'),
        distractionFiltering: String(prefs.tasks?.distractionFiltering ?? 'show_all'),
      },
      privacy: {
        sensitiveDataMasking: Boolean(prefs.privacy?.sensitiveDataMasking ?? false),
        auditLog: Boolean(prefs.privacy?.auditLog ?? false),
      },
      moneyPrefs: {
        dueDateWindowDays: Number(prefs.moneyPrefs?.dueDateWindowDays ?? 7),
        alertSeverity: String(prefs.moneyPrefs?.alertSeverity ?? 'warning'),
        financialSensitivity: String(prefs.moneyPrefs?.financialSensitivity ?? 'soft'),
        timeHorizonDays: Number(prefs.moneyPrefs?.timeHorizonDays ?? 7),
      },
    };
  });

  ipcMain.handle('settings:save', (_event, payload: Record<string, unknown>) => {
    if ('anthropicApiKey' in payload) store.set('anthropic.apiKey', payload.anthropicApiKey);
    if ('asanaToken' in payload) store.set('asana.token', payload.asanaToken);
    if ('gcalClientId' in payload) store.set('gcal.clientId', payload.gcalClientId);
    if ('gcalClientSecret' in payload) store.set('gcal.clientSecret', payload.gcalClientSecret);
    if ('gcalCalendarIds' in payload) store.set('gcal.calendarIds', payload.gcalCalendarIds);
    if ('gcalWriteCalendarId' in payload) {
      store.set('gcal.writeCalendarId', payload.gcalWriteCalendarId);
      store.set('gcal.calendarId', payload.gcalWriteCalendarId);
    }
    if ('workMins' in payload) store.set('pomodoro.workMins', payload.workMins);
    if ('breakMins' in payload) store.set('pomodoro.breakMins', payload.breakMins);
    if ('longBreakMins' in payload) store.set('pomodoro.longBreakMins', payload.longBreakMins);
    if ('blockedSites' in payload) store.set('focus.blockedSites', payload.blockedSites);
    if ('plaidClientId' in payload) store.set('plaid.clientId', payload.plaidClientId);
    if ('plaidSecret' in payload) store.set('plaid.secret', payload.plaidSecret);
    // User preferences
    if ('dayStartHour' in payload) store.set('userPrefs.day.startHour', payload.dayStartHour);
    if ('dayStartMin' in payload) store.set('userPrefs.day.startMin', payload.dayStartMin);
    if ('dayEndHour' in payload) store.set('userPrefs.day.endHour', payload.dayEndHour);
    if ('dayEndMin' in payload) store.set('userPrefs.day.endMin', payload.dayEndMin);
    if ('timeboxDefault' in payload) store.set('userPrefs.day.timeboxDefault', payload.timeboxDefault);
    if ('syncFrequencyMins' in payload) store.set('userPrefs.day.syncFrequencyMins', payload.syncFrequencyMins);
    if ('narrativeStyle' in payload) store.set('userPrefs.story.narrativeStyle', payload.narrativeStyle);
    if ('storyDepth' in payload) store.set('userPrefs.story.storyDepth', payload.storyDepth);
    if ('tone' in payload) store.set('userPrefs.story.tone', payload.tone);
    if ('accountabilityLevel' in payload) store.set('userPrefs.story.accountabilityLevel', payload.accountabilityLevel);
    if ('priorityRule' in payload) store.set('userPrefs.tasks.priorityRule', payload.priorityRule);
    if ('notificationIntensity' in payload) store.set('userPrefs.tasks.notificationIntensity', payload.notificationIntensity);
    if ('distractionFiltering' in payload) store.set('userPrefs.tasks.distractionFiltering', payload.distractionFiltering);
    if ('sensitiveDataMasking' in payload) store.set('userPrefs.privacy.sensitiveDataMasking', payload.sensitiveDataMasking);
    if ('auditLog' in payload) store.set('userPrefs.privacy.auditLog', payload.auditLog);
    if ('dueDateWindowDays' in payload) store.set('userPrefs.moneyPrefs.dueDateWindowDays', payload.dueDateWindowDays);
    if ('alertSeverity' in payload) store.set('userPrefs.moneyPrefs.alertSeverity', payload.alertSeverity);
    if ('financialSensitivity' in payload) store.set('userPrefs.moneyPrefs.financialSensitivity', payload.financialSensitivity);
    if ('timeHorizonDays' in payload) store.set('userPrefs.moneyPrefs.timeHorizonDays', payload.timeHorizonDays);
    return true;
  });
}

export { store };
