import { ipcMain, BrowserWindow } from 'electron';
import Store from 'electron-store';

const store = new Store();

const GCAL_BASE_URL = 'https://www.googleapis.com/calendar/v3';

// OAuth 2.0 config — user provides client ID/secret in Settings
function getOAuthConfig() {
  return {
    clientId: store.get('gcal.clientId') as string,
    clientSecret: store.get('gcal.clientSecret') as string,
    redirectUri: 'http://localhost:8234/callback',
    scope: 'https://www.googleapis.com/auth/calendar',
  };
}

async function getAccessToken(): Promise<string> {
  const token = store.get('gcal.accessToken') as string;
  const expiry = store.get('gcal.tokenExpiry') as number;

  if (token && expiry && Date.now() < expiry) {
    return token;
  }

  // Try refresh
  const refreshToken = store.get('gcal.refreshToken') as string;
  if (refreshToken) {
    const config = getOAuthConfig();
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      store.set('gcal.accessToken', data.access_token);
      store.set('gcal.tokenExpiry', Date.now() + data.expires_in * 1000);
      return data.access_token;
    }
  }

  throw new Error('GCal not authenticated. Go to Settings to connect.');
}

async function gcalFetch(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  const response = await fetch(`${GCAL_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GCal API error ${response.status}: ${error}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function getSelectedCalendarIds() {
  const ids = store.get('gcal.calendarIds') as string[] | undefined;
  if (Array.isArray(ids) && ids.length > 0) return ids;

  const legacyCalendarId = store.get('gcal.calendarId') as string | undefined;
  return [legacyCalendarId || 'primary'];
}

function getWriteCalendarId(explicitCalendarId?: string) {
  if (explicitCalendarId) return explicitCalendarId;
  const writeCalendarId = store.get('gcal.writeCalendarId') as string | undefined;
  if (writeCalendarId) return writeCalendarId;
  return getSelectedCalendarIds()[0] || 'primary';
}

export function registerGCalHandlers() {
  ipcMain.handle('gcal:get-events', async (_event, date: string) => {
    try {
      const timeMin = `${date}T00:00:00Z`;
      const timeMax = `${date}T23:59:59Z`;
      const calendarIds = getSelectedCalendarIds();

      const results = await Promise.all(
        calendarIds.map(async (calendarId) => {
          const result = await gcalFetch(
            `/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`
          );
          return (result.items || []).map((item: Record<string, unknown>) => ({
            ...item,
            calendarId,
          }));
        })
      );

      const items = results
        .flat()
        .sort((a, b) => {
          const aStart = String((a.start as { dateTime?: string; date?: string })?.dateTime || (a.start as { date?: string })?.date || '');
          const bStart = String((b.start as { dateTime?: string; date?: string })?.dateTime || (b.start as { date?: string })?.date || '');
          return aStart.localeCompare(bStart);
        });

      return { success: true, data: items };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gcal:list-calendars', async () => {
    try {
      const result = await gcalFetch('/users/me/calendarList');
      return { success: true, data: result.items || [] };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('gcal:create-event', async (_event, event: unknown, calendarId?: string) => {
    try {
      const targetCalendarId = getWriteCalendarId(calendarId);
      const result = await gcalFetch(
        `/calendars/${encodeURIComponent(targetCalendarId)}/events`,
        { method: 'POST', body: JSON.stringify(event) }
      );
      return { success: true, data: { ...result, calendarId: targetCalendarId } };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    'gcal:update-event',
    async (_event, eventId: string, event: unknown, calendarId?: string) => {
      try {
        const targetCalendarId = getWriteCalendarId(calendarId);
        const result = await gcalFetch(
          `/calendars/${encodeURIComponent(targetCalendarId)}/events/${eventId}`,
          { method: 'PATCH', body: JSON.stringify(event) }
        );
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle('gcal:delete-event', async (_event, eventId: string, calendarId?: string) => {
    try {
      const targetCalendarId = getWriteCalendarId(calendarId);
      await gcalFetch(
        `/calendars/${encodeURIComponent(targetCalendarId)}/events/${eventId}`,
        { method: 'DELETE' }
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // OAuth flow — opens browser window for Google sign-in
  ipcMain.handle('gcal:auth', async () => {
    const config = getOAuthConfig();
    if (!config.clientId || !config.clientSecret) {
      return { success: false, error: 'GCal client ID/secret not configured' };
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&response_type=code&scope=${encodeURIComponent(config.scope)}&access_type=offline&prompt=consent`;

    // Open auth window
    const authWindow = new BrowserWindow({
      width: 500,
      height: 700,
      show: true,
      webPreferences: { nodeIntegration: false },
    });

    authWindow.loadURL(authUrl);

    return new Promise((resolve) => {
      // Listen for redirect with code
      authWindow.webContents.on('will-redirect', async (_event, url) => {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');

        if (code) {
          authWindow.close();

          // Exchange code for tokens
          const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: config.clientId,
              client_secret: config.clientSecret,
              code,
              grant_type: 'authorization_code',
              redirect_uri: config.redirectUri,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            store.set('gcal.accessToken', data.access_token);
            store.set('gcal.refreshToken', data.refresh_token);
            store.set('gcal.tokenExpiry', Date.now() + data.expires_in * 1000);
            resolve({ success: true });
          } else {
            resolve({ success: false, error: 'Token exchange failed' });
          }
        }
      });

      authWindow.on('closed', () => {
        resolve({ success: false, error: 'Auth window closed' });
      });
    });
  });
}
