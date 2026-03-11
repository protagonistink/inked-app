import { ipcMain } from 'electron';
import { exec } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { store } from './store';

const HOSTS_PATH = '/etc/hosts';
const HOSTS_MARKER = '# TimeFocus Focus Mode';

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
    ...sites.map((site) => `127.0.0.1 ${site}\n127.0.0.1 www.${site}`),
    `${HOSTS_MARKER} END`,
    '',
  ].join('\n');

  // This requires sudo — will prompt the user via osascript
  return new Promise<void>((resolve, reject) => {
    const escaped = block.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    exec(
      `osascript -e 'do shell script "echo \\"${escaped}\\" >> ${HOSTS_PATH} && dscacheutil -flushcache && killall -HUP mDNSResponder" with administrator privileges'`,
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

async function unblockSites() {
  const hostsContent = await readFile(HOSTS_PATH, 'utf-8');

  if (!hostsContent.includes(HOSTS_MARKER)) return;

  // Remove everything between markers
  const cleaned = hostsContent.replace(
    new RegExp(`\\n?${HOSTS_MARKER}[\\s\\S]*?${HOSTS_MARKER} END\\n?`, 'g'),
    ''
  );

  return new Promise<void>((resolve, reject) => {
    const escaped = cleaned.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    exec(
      `osascript -e 'do shell script "echo \\"${escaped}\\" > ${HOSTS_PATH} && dscacheutil -flushcache && killall -HUP mDNSResponder" with administrator privileges'`,
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

export function registerFocusHandlers() {
  ipcMain.handle('focus:enable', async () => {
    try {
      await Promise.all([enableStageManager(), blockSites()]);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('focus:disable', async () => {
    try {
      await Promise.all([disableStageManager(), unblockSites()]);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
