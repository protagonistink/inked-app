import { ipcMain, BrowserWindow } from 'electron';
import { store } from './store';
import { getSecure } from './secure-store';
import crypto from 'node:crypto';
import type { CaptureColor } from '../src/types';

const COLORS: CaptureColor[] = ['yellow', 'pink', 'blue', 'green', 'orange', 'lavender'];

interface StoredCapture {
  id: string;
  text: string;
  color: CaptureColor;
  createdAt: string;
}

function todayPrefix(): string {
  return new Date().toISOString().split('T')[0];
}

function getEntries(): StoredCapture[] {
  const raw = store.get('scratch.entries') as StoredCapture[] | undefined;
  return Array.isArray(raw) ? raw : [];
}

function setEntries(entries: StoredCapture[]) {
  store.set('scratch.entries', entries);
}

export function purgeStaleCapturesOnWake() {
  const prefix = todayPrefix();
  const entries = getEntries();
  const fresh = entries.filter((e) => e.createdAt.startsWith(prefix));
  if (fresh.length !== entries.length) setEntries(fresh);
}

export function registerCaptureHandlers(
  getCaptureWindow: () => BrowserWindow | null = () => null,
  getMainWindow: () => BrowserWindow | null = () => null,
) {
  ipcMain.handle('capture:list', () => {
    const prefix = todayPrefix();
    return getEntries().filter((e) => e.createdAt.startsWith(prefix));
  });

  ipcMain.handle('capture:add', (_event, text: string) => {
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Capture text must be a non-empty string');
    }
    const trimmed = text.trim().slice(0, 500);
    const entry: StoredCapture = {
      id: crypto.randomUUID(),
      text: trimmed,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      createdAt: new Date().toISOString(),
    };
    const entries = getEntries();
    entries.push(entry);
    setEntries(entries);
    return entry;
  });

  ipcMain.handle('capture:remove', (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid capture ID');
    const entries = getEntries();
    setEntries(entries.filter((e) => e.id !== id));
    return true;
  });

  ipcMain.handle('capture:purge-stale', () => {
    purgeStaleCapturesOnWake();
    return true;
  });

  ipcMain.handle('capture:send-to-notion', async (_event, text: string) => {
    const apiKey = getSecure('notion.apiKey');
    const pageId = store.get('notion.capturePageId') as string;
    if (!apiKey) throw new Error('Notion API key not configured. Go to Settings.');
    if (!pageId) throw new Error('Notion capture page not configured. Go to Settings.');
    if (typeof text !== 'string' || !text.trim()) throw new Error('Text required');

    const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        children: [{
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: text.trim().slice(0, 2000) } }],
          },
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion API error ${response.status}: ${error}`);
    }
    return { success: true };
  });

  ipcMain.handle('capture:hide-capture-window', () => {
    getCaptureWindow()?.hide();
  });
}
