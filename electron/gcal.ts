import crypto from 'node:crypto';
import http from 'node:http';
import { ipcMain, BrowserWindow, shell } from 'electron';
import { store } from './store';
import { getSecure, setSecure } from './secure-store';
import { buildLocalDayWindow } from './gcalDayWindow';
import { assertRateLimit, logSecurityEvent } from './security';

const GCAL_BASE_URL = 'https://www.googleapis.com/calendar/v3';
const GCAL_ID_RE = /^[A-Za-z0-9@._-]+$/;

export function normalizeCalendarSelection(
  calendarIds: string[] | undefined,
  writeCalendarId?: string,
): string[] {
  const normalized = Array.isArray(calendarIds)
    ? calendarIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];
  const writeId = typeof writeCalendarId === 'string' && writeCalendarId.trim().length > 0
    ? writeCalendarId
    : undefined;

  if (writeId && !normalized.includes(writeId)) normalized.push(writeId);
  return normalized.length > 0 ? normalized : ['primary'];
}

// OAuth 2.0 config — user provides client ID/secret in Settings
function getOAuthConfig() {
  return {
    clientId: getSecure('gcal.clientId'),
    clientSecret: getSecure('gcal.clientSecret'),
    scope: 'https://www.googleapis.com/auth/calendar',
  };
}

async function getAccessToken(): Promise<string> {
  const token = getSecure('gcal.accessToken');
  const expiry = store.get('gcal.tokenExpiry') as number;

  if (token && expiry && Date.now() < expiry) {
    return token;
  }

  // Try refresh
  const refreshToken = getSecure('gcal.refreshToken');
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
      setSecure('gcal.accessToken', data.access_token);
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
  const writeCalendarId = store.get('gcal.writeCalendarId') as string | undefined;
  const normalized = normalizeCalendarSelection(ids, writeCalendarId);
  if (normalized.length > 0) return normalized;

  const legacyCalendarId = store.get('gcal.calendarId') as string | undefined;
  return [legacyCalendarId || 'primary'];
}

function getWriteCalendarId(explicitCalendarId?: string) {
  if (explicitCalendarId) return explicitCalendarId;
  const writeCalendarId = store.get('gcal.writeCalendarId') as string | undefined;
  if (writeCalendarId) return writeCalendarId;
  return getSelectedCalendarIds()[0] || 'primary';
}

function sanitizeCalendarId(calendarId?: string) {
  if (!calendarId) return undefined;
  if (!GCAL_ID_RE.test(calendarId)) throw new Error('Invalid calendar ID');
  return calendarId;
}

function sanitizeEventId(eventId: string) {
  if (!GCAL_ID_RE.test(eventId)) throw new Error('Invalid event ID');
  return eventId;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function sanitizeCalendarEventInput(event: unknown) {
  if (!event || typeof event !== 'object') throw new Error('Invalid calendar event');
  const candidate = event as Record<string, unknown>;
  const summary = typeof candidate.summary === 'string' ? candidate.summary.trim().slice(0, 500) : '';
  if (!summary) throw new Error('Event summary is required');
  const description = typeof candidate.description === 'string' ? candidate.description.slice(0, 10_000) : undefined;
  const start = candidate.start as Record<string, unknown> | undefined;
  const end = candidate.end as Record<string, unknown> | undefined;
  if (!start || !end) throw new Error('Event start and end are required');
  if (!isIsoDateTime(start.dateTime) || !isIsoDateTime(end.dateTime)) {
    throw new Error('Invalid event dateTime');
  }
  if (typeof start.timeZone !== 'string' || typeof end.timeZone !== 'string') {
    throw new Error('Invalid event timeZone');
  }

  return {
    summary,
    description,
    start: {
      dateTime: start.dateTime,
      timeZone: start.timeZone.slice(0, 100),
    },
    end: {
      dateTime: end.dateTime,
      timeZone: end.timeZone.slice(0, 100),
    },
  };
}

export function registerGCalHandlers() {
  ipcMain.handle('gcal:get-events', async (_event, date: string) => {
    try {
      const { timeMin, timeMax } = buildLocalDayWindow(date);
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

  ipcMain.handle('gcal:create-event', async (ipcEvent, event: unknown, calendarId?: string) => {
    try {
      assertRateLimit('gcal:create-event', ipcEvent.sender.id, 500);
      const targetCalendarId = getWriteCalendarId(sanitizeCalendarId(calendarId));
      const sanitizedEvent = sanitizeCalendarEventInput(event);
      logSecurityEvent('gcal.createEvent', {
        senderId: ipcEvent.sender.id,
        calendarId: targetCalendarId,
        summaryLength: sanitizedEvent.summary.length,
      });
      const result = await gcalFetch(
        `/calendars/${encodeURIComponent(targetCalendarId)}/events`,
        { method: 'POST', body: JSON.stringify(sanitizedEvent) }
      );
      return { success: true, data: { ...result, calendarId: targetCalendarId } };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    'gcal:update-event',
    async (ipcEvent, eventId: string, event: unknown, calendarId?: string) => {
      try {
        assertRateLimit('gcal:update-event', ipcEvent.sender.id, 500);
        const targetCalendarId = getWriteCalendarId(sanitizeCalendarId(calendarId));
        const sanitizedEventId = sanitizeEventId(eventId);
        const sanitizedEvent = sanitizeCalendarEventInput(event);
        logSecurityEvent('gcal.updateEvent', {
          senderId: ipcEvent.sender.id,
          calendarId: targetCalendarId,
          eventId: sanitizedEventId,
          summaryLength: sanitizedEvent.summary.length,
        });
        const result = await gcalFetch(
          `/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(sanitizedEventId)}`,
          { method: 'PATCH', body: JSON.stringify(sanitizedEvent) }
        );
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );

  ipcMain.handle('gcal:delete-event', async (ipcEvent, eventId: string, calendarId?: string) => {
    try {
      assertRateLimit('gcal:delete-event', ipcEvent.sender.id, 500);
      const targetCalendarId = getWriteCalendarId(sanitizeCalendarId(calendarId));
      const sanitizedEventId = sanitizeEventId(eventId);
      logSecurityEvent('gcal.deleteEvent', {
        senderId: ipcEvent.sender.id,
        calendarId: targetCalendarId,
        eventId: sanitizedEventId,
      });
      await gcalFetch(
        `/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(sanitizedEventId)}`,
        { method: 'DELETE' }
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // OAuth flow with PKCE — opens system browser, listens on a temporary local server
  ipcMain.handle('gcal:auth', async () => {
    const config = getOAuthConfig();
    if (!config.clientId || !config.clientSecret) {
      return { success: false, error: 'GCal client ID/secret not configured' };
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return new Promise((resolve) => {
      let settled = false;
      function settle(result: { success: boolean; error?: string }) {
        if (settled) return;
        settled = true;
        server.close();
        resolve(result);
      }

      // Create a temporary HTTP server on a random port
      const server = http.createServer(async (req, res) => {
        const reqUrl = new URL(req.url ?? '/', `http://127.0.0.1`);
        if (!reqUrl.pathname.startsWith('/callback')) {
          res.writeHead(404);
          res.end();
          return;
        }

        const code = reqUrl.searchParams.get('code');
        const error = reqUrl.searchParams.get('error');

        if (error || !code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body style="font-family:system-ui;text-align:center;padding:40px"><h2>Authentication failed</h2><p>You can close this tab.</p></body></html>');
          settle({ success: false, error: error || 'No auth code received' });
          return;
        }

        // Exchange code for tokens with PKCE verifier
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        const redirectUri = `http://127.0.0.1:${port}/callback`;

        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setSecure('gcal.accessToken', data.access_token);
          setSecure('gcal.refreshToken', data.refresh_token);
          store.set('gcal.tokenExpiry', Date.now() + data.expires_in * 1000);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body style="font-family:system-ui;text-align:center;padding:40px"><h2>Connected to Google Calendar</h2><p>You can close this tab and return to Inked.</p></body></html>');
          settle({ success: true });
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body style="font-family:system-ui;text-align:center;padding:40px"><h2>Token exchange failed</h2><p>You can close this tab.</p></body></html>');
          settle({ success: false, error: 'Token exchange failed' });
        }
      });

      // Listen on random port on loopback only
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        const redirectUri = `http://127.0.0.1:${port}/callback`;

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', config.clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', config.scope);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        // Open in system browser instead of an Electron BrowserWindow
        shell.openExternal(authUrl.toString());
      });

      // Auto-close after 5 minutes if no callback received
      setTimeout(() => {
        settle({ success: false, error: 'OAuth timed out' });
      }, 5 * 60 * 1000);
    });
  });
}
