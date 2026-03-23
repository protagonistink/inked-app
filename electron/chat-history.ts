import { ipcMain } from 'electron';
import { store } from './store';

interface StoredChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatHistoryEntry {
  date: string; // YYYY-MM-DD
  messages: StoredChatMessage[];
  updatedAt: string; // ISO timestamp
}

const STORE_KEY = 'chatHistory';
const MAX_DAYS = 3; // Keep chat history for 3 days

function readHistory(): ChatHistoryEntry[] {
  const raw = store.get(STORE_KEY) as ChatHistoryEntry[] | undefined;
  return Array.isArray(raw) ? raw : [];
}

function trimOldEntries(entries: ChatHistoryEntry[]): ChatHistoryEntry[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_DAYS);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return entries.filter((e) => e.date >= cutoffStr);
}

export function registerChatHistoryHandlers() {
  // Load today's chat messages
  ipcMain.handle('chat:load', (_event, date: string) => {
    const entries = readHistory();
    const entry = entries.find((e) => e.date === date);
    return entry?.messages ?? [];
  });

  // Save chat messages for a given date
  ipcMain.handle('chat:save', (_event, date: string, messages: StoredChatMessage[]) => {
    const entries = readHistory();
    const existingIndex = entries.findIndex((e) => e.date === date);

    const newEntry: ChatHistoryEntry = {
      date,
      messages,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      entries[existingIndex] = newEntry;
    } else {
      entries.push(newEntry);
    }

    store.set(STORE_KEY, trimOldEntries(entries));
    return true;
  });

  // Clear chat history for a given date
  ipcMain.handle('chat:clear', (_event, date: string) => {
    const entries = readHistory();
    store.set(STORE_KEY, entries.filter((e) => e.date !== date));
    return true;
  });
}
