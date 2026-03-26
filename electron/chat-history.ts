import { ipcMain } from 'electron';
import crypto from 'node:crypto';
import { store } from './store';
import type { ChatMessage as StoredChatMessage, ChatThread, ChatThreadSummary } from '../src/types';

interface LegacyChatHistoryEntry {
  date: string;
  messages: StoredChatMessage[];
  updatedAt: string;
}

const STORE_KEY = 'chatHistory';
const MAX_DAYS = 3; // Keep chat history for 3 days
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  return DATE_RE.test(value);
}

function sanitizeMessages(messages: StoredChatMessage[]): StoredChatMessage[] {
  return messages
    .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
    .map((message) => ({
      role: message.role,
      content: typeof message.content === 'string' ? message.content.slice(0, 50_000) : '',
      attachments: Array.isArray(message.attachments)
        ? message.attachments
            .filter((attachment) =>
              attachment &&
              attachment.kind === 'image' &&
              typeof attachment.dataUrl === 'string' &&
              typeof attachment.name === 'string' &&
              (attachment.mediaType === 'image/jpeg' || attachment.mediaType === 'image/png' || attachment.mediaType === 'image/webp')
            )
            .slice(0, 8)
            .map((attachment) => ({
              kind: 'image' as const,
              dataUrl: attachment.dataUrl.slice(0, 5_000_000),
              mediaType: attachment.mediaType,
              name: attachment.name.slice(0, 240),
            }))
        : undefined,
    }));
}

function summarizeThread(thread: ChatThread): ChatThreadSummary {
  const previewSource = [...thread.messages].reverse().find((message) => message.content.trim().length > 0)?.content ?? '';
  return {
    id: thread.id,
    date: thread.date,
    mode: thread.mode,
    title: thread.title,
    preview: previewSource.trim().slice(0, 120),
    messageCount: thread.messages.length,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

function toThreadTitle(thread: ChatThread): string {
  const firstUserMessage = thread.messages.find((message) => message.role === 'user' && message.content.trim().length > 0)?.content.trim();
  if (firstUserMessage) return firstUserMessage.slice(0, 60);
  return thread.title;
}

function isThread(value: unknown): value is ChatThread {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ChatThread>;
  return typeof candidate.id === 'string'
    && typeof candidate.date === 'string'
    && (candidate.mode === 'briefing' || candidate.mode === 'chat' || candidate.mode === 'eod')
    && typeof candidate.title === 'string'
    && Array.isArray(candidate.messages)
    && typeof candidate.createdAt === 'string'
    && typeof candidate.updatedAt === 'string';
}

function migrateLegacyHistory(entries: LegacyChatHistoryEntry[]): ChatThread[] {
  return entries.map((entry) => {
    const createdAt = entry.updatedAt || new Date(`${entry.date}T09:00:00.000Z`).toISOString();
    const thread: ChatThread = {
      id: `thread-${crypto.randomUUID()}`,
      date: entry.date,
      mode: 'chat',
      title: 'Conversation',
      messages: sanitizeMessages(entry.messages),
      createdAt,
      updatedAt: entry.updatedAt || createdAt,
    };
    return { ...thread, title: toThreadTitle(thread) };
  });
}

function readThreads(): ChatThread[] {
  const raw = store.get(STORE_KEY) as unknown;
  if (!Array.isArray(raw)) return [];
  if (raw.every(isThread)) return raw.map((thread) => ({ ...thread, messages: sanitizeMessages(thread.messages) }));
  const legacyEntries = raw as LegacyChatHistoryEntry[];
  const migrated = migrateLegacyHistory(legacyEntries);
  store.set(STORE_KEY, trimOldEntries(migrated));
  return migrated;
}

function trimOldEntries(entries: ChatThread[]): ChatThread[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_DAYS);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return entries.filter((e) => e.date >= cutoffStr);
}

function defaultThreadTitle(mode: ChatThread['mode']) {
  if (mode === 'briefing') return 'Outline';
  if (mode === 'eod') return 'Evening reflection';
  return 'New conversation';
}

export function registerChatHistoryHandlers() {
  ipcMain.handle('chat:list', () => {
    return readThreads()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(summarizeThread);
  });

  ipcMain.handle('chat:load-thread', (_event, threadId: string) => {
    const thread = readThreads().find((entry) => entry.id === threadId);
    return thread ?? null;
  });

  ipcMain.handle('chat:create-thread', (_event, params: { date: string; mode: ChatThread['mode']; seedTitle?: string }) => {
    if (!isValidDate(params.date)) {
      throw new Error('Invalid chat thread payload');
    }
    const entries = readThreads();
    const now = new Date().toISOString();
    const thread: ChatThread = {
      id: `thread-${crypto.randomUUID()}`,
      date: params.date,
      mode: params.mode,
      title: (params.seedTitle?.trim() || defaultThreadTitle(params.mode)).slice(0, 80),
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    store.set(STORE_KEY, trimOldEntries([thread, ...entries]));
    return thread;
  });

  ipcMain.handle('chat:save-thread', (_event, threadId: string, messages: StoredChatMessage[]) => {
    if (!threadId || !Array.isArray(messages)) {
      throw new Error('Invalid chat thread payload');
    }
    const entries = readThreads();
    const existingIndex = entries.findIndex((entry) => entry.id === threadId);
    if (existingIndex < 0) return null;

    const existing = entries[existingIndex];
    const updatedThread: ChatThread = {
      ...existing,
      messages: sanitizeMessages(messages),
      updatedAt: new Date().toISOString(),
    };
    updatedThread.title = toThreadTitle(updatedThread).slice(0, 80);
    entries[existingIndex] = updatedThread;

    store.set(STORE_KEY, trimOldEntries(entries));
    return summarizeThread(updatedThread);
  });

  ipcMain.handle('chat:delete-thread', (_event, threadId: string) => {
    if (!threadId) return true;
    const entries = readThreads();
    store.set(STORE_KEY, entries.filter((entry) => entry.id !== threadId));
    return true;
  });

  ipcMain.handle('chat:clearOld', (_event, today: string) => {
    if (!isValidDate(today)) {
      throw new Error('Invalid chat history date');
    }
    const entries = readThreads();
    store.set(STORE_KEY, trimOldEntries(entries));
    return true;
  });
}
