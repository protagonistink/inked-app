import { app, BrowserWindow, globalShortcut, ipcMain, screen, shell, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { registerAsanaHandlers } from './asana';
import { registerGCalHandlers } from './gcal';
import { registerStoreHandlers } from './store';
import { registerTimerHandlers, setTrayUpdater, startLastUsedPomodoro } from './timer';
import { registerFocusHandlers } from './focus';
import { registerAnthropicHandlers } from './anthropic';
import { registerInkContextHandlers } from './ink-context';
import { registerChatHistoryHandlers } from './chat-history';
import { registerFinanceHandlers } from './finance';

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');
const APP_ICON_PATH = path.join(__dirname, '../build/icon.png');
const TRAY_ICON_PATH = path.join(process.env.VITE_PUBLIC!, 'icon-tray.png');

let mainWindow: BrowserWindow | null;
let pomodoroWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = sw < 1600 ? Math.min(sw - 80, 1400) : 1600;
  const winHeight = sh < 900 ? Math.min(sh - 60, 860) : 900;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0A0A0A',
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow?.hide();
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'));
  }
}

function createTray() {
  const icon = nativeImage.createFromPath(TRAY_ICON_PATH);
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip('Inked');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Inked',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    {
      label: 'Start thread',
      click: () => {
        const lastTask = startLastUsedPomodoro();
        if (!lastTask) return;
        if (!pomodoroWindow) createPomodoroWindow();
        pomodoroWindow?.showInactive();
        pomodoroWindow?.moveTop();
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.exit(); } },
  ]);
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow?.show();
    }
  });

  setTrayUpdater((state) => {
    if (!tray) return;
    if (!state.isRunning) {
      tray.setTitle('');
    } else {
      const mins = Math.floor(state.timeRemaining / 60);
      const secs = String(state.timeRemaining % 60).padStart(2, '0');
      const prefix = state.isPaused ? '⏸' : state.isBreak ? '☕' : '🍅';
      tray.setTitle(`${prefix} ${mins}:${secs}`);
    }
  });
}

function createPomodoroWindow() {
  const workArea = screen.getPrimaryDisplay().workArea;
  const width = 220;
  const height = 156;

  pomodoroWindow = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 20,
    y: workArea.y + workArea.height - height - 20,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    show: false,
    backgroundColor: '#0A0A0A',
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  pomodoroWindow.setAlwaysOnTop(true, 'screen-saver');
  pomodoroWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (VITE_DEV_SERVER_URL) {
    pomodoroWindow.loadURL(`${VITE_DEV_SERVER_URL}#/pomodoro`);
  } else {
    pomodoroWindow.loadFile(path.join(process.env.DIST!, 'index.html'), {
      hash: '/pomodoro',
    });
  }

  pomodoroWindow.on('closed', () => {
    pomodoroWindow = null;
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    mainWindow = null;
  }
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
});

app.whenReady().then(() => {
  // Set up native app menu so Cmd+Q (macOS) / Alt+F4 works
  const appMenu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit Inked', accelerator: 'CmdOrCtrl+Q', click: () => { app.exit(); } },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ]);
  Menu.setApplicationMenu(appMenu);

  registerAsanaHandlers();
  registerGCalHandlers();
  registerStoreHandlers();
  registerTimerHandlers();
  registerFocusHandlers();
  registerAnthropicHandlers();
  registerInkContextHandlers();
  registerChatHistoryHandlers();
  registerFinanceHandlers();

  ipcMain.handle('window:show-pomodoro', () => {
    if (!pomodoroWindow) createPomodoroWindow();
    pomodoroWindow?.showInactive();
    pomodoroWindow?.moveTop();
  });

  ipcMain.handle('window:hide-pomodoro', () => {
    pomodoroWindow?.hide();
  });

  ipcMain.handle('window:activate', () => {
    app.focus({ steal: true });
    pomodoroWindow?.focus();
  });

  ipcMain.handle('window:set-focus-size', () => {
    // Window resize intentionally removed.
    // Calling setSize() while Chromium's compositor is active triggers a
    // SharedImageManager mailbox race condition (SIGSEGV exit 11) on macOS
    // Electron 33 in both GPU and software-rendering paths. There is no
    // Electron/Chromium API to synchronously flush the compositor pipeline
    // before resize. Focus mode layout collapse is handled entirely via
    // React state (sidebar/inbox/TodaysFlow collapse). The window stays at
    // whatever size the user had it.
  });

  ipcMain.handle('window:show-main', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  });

  ipcMain.handle('shell:open-external', (_, url: string) => {
    void shell.openExternal(url);
  });

  createWindow();
  createTray();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
