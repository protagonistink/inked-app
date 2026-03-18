import { ipcMain } from 'electron';
import { exec } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { store } from './store';

const HOSTS_PATH = '/etc/hosts';
const HOSTS_MARKER = '# Inked Focus Mode';
const STAGE_MANAGER_STORE_KEY = 'focus.stageManagerWasEnabled';

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function runPrivilegedShell(command: string) {
  const script = `do shell script ${JSON.stringify(command)} with administrator privileges`;

  return new Promise<void>((resolve, reject) => {
    exec(`osascript -e ${shellQuote(script)}`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function readStageManagerEnabled() {
  return new Promise<boolean>((resolve, reject) => {
    exec(`defaults read com.apple.WindowManager GloballyEnabled`, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }

      const normalized = stdout.trim().toLowerCase();
      resolve(normalized === '1' || normalized === 'true');
    });
  });
}

async function enableStageManager() {
  return new Promise<void>((resolve, reject) => {
    exec(
      `defaults write com.apple.WindowManager GloballyEnabled -bool true && killall Dock`,
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

async function disableStageManager() {
  return new Promise<void>((resolve, reject) => {
    exec(
      `defaults write com.apple.WindowManager GloballyEnabled -bool false && killall Dock`,
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

async function blockSites() {
  const sites = (store.get('focus.blockedSites') as string[]) || [];
  if (sites.length === 0) return;

  const hostsContent = await readFile(HOSTS_PATH, 'utf-8');

  // Don't add if already present
  if (hostsContent.includes(HOSTS_MARKER)) return;

  const block = [
    '',
    HOSTS_MARKER,
    ...sites.flatMap((site) => [`127.0.0.1 ${site}`, `127.0.0.1 www.${site}`]),
    `${HOSTS_MARKER} END`,
    '',
  ].join('\n');

  await runPrivilegedShell(
    `printf %s ${shellQuote(block)} >> ${shellQuote(HOSTS_PATH)} && dscacheutil -flushcache && killall -HUP mDNSResponder`
  );
}

async function unblockSites() {
  const hostsContent = await readFile(HOSTS_PATH, 'utf-8');

  if (!hostsContent.includes(HOSTS_MARKER)) return;

  const removalScript = String.raw`\n?\Q# Inked Focus Mode\E[\s\S]*?\Q# Inked Focus Mode END\E\n?`;
  await runPrivilegedShell(
    `/usr/bin/perl -0pi -e ${shellQuote(`s/${removalScript}//g`)} ${shellQuote(HOSTS_PATH)} && dscacheutil -flushcache && killall -HUP mDNSResponder`
  );
}

export function registerFocusHandlers() {
  ipcMain.handle('focus:enable', async () => {
    try {
      const wasEnabled = await readStageManagerEnabled();
      store.set(STAGE_MANAGER_STORE_KEY, wasEnabled);
      await Promise.all([enableStageManager(), blockSites()]);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('focus:disable', async () => {
    try {
      const shouldRestoreEnabled = (store.get(STAGE_MANAGER_STORE_KEY) as boolean | undefined) ?? false;
      await Promise.all([
        shouldRestoreEnabled ? enableStageManager() : disableStageManager(),
        unblockSites(),
      ]);
      store.delete(STAGE_MANAGER_STORE_KEY);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
