import { ipcMain, BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { store } from './store';

export interface ScratchEntry {
  id: string;
  text: string;
  createdAt: string;
}

function getAllEntries(): ScratchEntry[] {
  const raw = store.get('scratch.entries') as ScratchEntry[] | undefined;
  return Array.isArray(raw) ? raw : [];
}

function getTodayEntries(): ScratchEntry[] {
  const today = new Date().toISOString().split('T')[0];
  return getAllEntries().filter((e) => e.createdAt.startsWith(today));
}

function addEntry(text: string): ScratchEntry {
  const all = getAllEntries();
  const now = new Date();
  const entry: ScratchEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: text.trim(),
    createdAt: now.toISOString(),
  };

  // Keep entries for 7 days only
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const trimmed = all.filter((e) => e.createdAt >= cutoffStr);
  trimmed.push(entry);

  store.set('scratch.entries', trimmed);
  return entry;
}

function updateEntry(id: string, text: string): ScratchEntry | null {
  const all = getAllEntries();
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], text: text.trim() };
  store.set('scratch.entries', all);
  return all[idx];
}

function deleteEntry(id: string): void {
  const all = getAllEntries();
  store.set('scratch.entries', all.filter((e) => e.id !== id));
}

function broadcastToAllWindows(channel: string, data: unknown) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, data);
  });
}

// --- Capture window ---

let captureWindow: BrowserWindow | null = null;
let isSubmitting = false;

export function createCaptureWindow(): BrowserWindow {
  if (captureWindow && !captureWindow.isDestroyed()) {
    return captureWindow;
  }

  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = 500;
  const winHeight = 100;

  captureWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: Math.round((sw - winWidth) / 2),
    y: Math.round(sh * 0.25),
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    show: false,
    backgroundColor: '#0A0A0A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  captureWindow.setAlwaysOnTop(true, 'screen-saver');
  captureWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
  if (VITE_DEV_SERVER_URL) {
    captureWindow.loadURL(`${VITE_DEV_SERVER_URL}#/capture`);
  } else {
    captureWindow.loadFile(path.join(process.env.DIST!, 'index.html'), {
      hash: '/capture',
    });
  }

  captureWindow.on('blur', () => {
    if (!isSubmitting && captureWindow && !captureWindow.isDestroyed()) {
      captureWindow.hide();
    }
  });

  captureWindow.on('closed', () => {
    captureWindow = null;
  });

  return captureWindow;
}

export function registerCaptureHandlers() {
  ipcMain.handle('capture:save', (_event, text: string) => {
    if (!text?.trim()) return null;
    isSubmitting = true;
    const entry = addEntry(text);
    broadcastToAllWindows('capture:new-entry', entry);
    isSubmitting = false;
    return entry;
  });

  ipcMain.handle('capture:get-today', () => {
    return getTodayEntries();
  });

  ipcMain.handle('capture:update', (_event, id: string, text: string) => {
    const updated = updateEntry(id, text);
    if (updated) broadcastToAllWindows('capture:entry-updated', updated);
    return updated;
  });

  ipcMain.handle('capture:delete', (_event, id: string) => {
    deleteEntry(id);
    broadcastToAllWindows('capture:entry-deleted', id);
  });

  ipcMain.handle('window:hide-capture', () => {
    if (captureWindow && !captureWindow.isDestroyed()) {
      captureWindow.hide();
    }
  });
}

// Export for briefing context
export { getTodayEntries, getAllEntries };
