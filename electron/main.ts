import { app, BrowserWindow, globalShortcut, ipcMain, screen, shell, Tray, Menu, MenuItemConstructorOptions, nativeImage, session } from 'electron';
import path from 'node:path';
import { registerAsanaHandlers } from './asana';
import { registerGCalHandlers } from './gcal';
import { registerStoreHandlers } from './store';
import { registerTimerHandlers, setTrayUpdater, setFocusTimerCallbacks, startLastUsedPomodoro } from './timer';
import { registerFocusHandlers } from './focus';
import { registerAnthropicHandlers } from './anthropic';
import { registerInkContextHandlers } from './ink-context';
import { registerChatHistoryHandlers } from './chat-history';
import { registerFinanceHandlers } from './finance';
import { registerStripeHandlers } from './stripe';
import { registerCaptureHandlers, purgeStaleCapturesOnWake } from './capture';
import { migrateToEncrypted } from './secure-store';
import { assertRateLimit, logSecurityEvent } from './security';

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');
const APP_ICON_PATH = path.join(__dirname, '../build/icon.png');
const TRAY_ICON_PATH = path.join(process.env.VITE_PUBLIC!, 'icon-tray.png');

let mainWindow: BrowserWindow | null;
let captureWindow: BrowserWindow | null = null;
let focusTimerWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

if (VITE_DEV_SERVER_URL) {
  app.disableHardwareAcceleration();
}

function installSecurityPolicies() {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler(() => false);

  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });
  });
}

function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = sw < 1600 ? Math.min(sw - 80, 1400) : 1600;
  const winHeight = sh < 900 ? Math.min(sh - 60, 860) : 900;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 1200,
    minHeight: 700,
    safeDialogs: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0A0A0A',
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      const isLocalAppNavigation =
        parsed.protocol === 'file:' ||
        (VITE_DEV_SERVER_URL ? url.startsWith(VITE_DEV_SERVER_URL) : false);

      if (isLocalAppNavigation) return;
    } catch {
      // Fall through and block malformed navigation attempts.
    }

    event.preventDefault();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'));
  }
}

function createCaptureWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  captureWindow = new BrowserWindow({
    width: 340,
    height: 320,
    x: Math.round(sw / 2 - 170),
    y: Math.round(sh * 0.22),
    minWidth: 280,
    minHeight: 240,
    maxWidth: 480,
    maxHeight: 440,
    frame: false,
    alwaysOnTop: true,
    level: 'floating',
    skipTaskbar: true,
    resizable: true,
    show: false,
    backgroundColor: '#FEF3C7',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  captureWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  captureWindow.on('blur', () => {
    captureWindow?.hide();
  });
  captureWindow.on('closed', () => { captureWindow = null; });

  if (VITE_DEV_SERVER_URL) {
    void captureWindow.loadURL(`${VITE_DEV_SERVER_URL}?mode=capture`);
  } else {
    void captureWindow.loadFile(path.join(process.env.DIST!, 'index.html'), {
      query: { mode: 'capture' },
    });
  }
}

function createFocusTimerWindow() {
  if (focusTimerWindow && !focusTimerWindow.isDestroyed()) {
    focusTimerWindow.show();
    return;
  }

  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;

  focusTimerWindow = new BrowserWindow({
    width: 280,
    height: 88,
    x: sw - 300,
    y: 20,
    frame: false,
    alwaysOnTop: true,
    level: 'floating',
    skipTaskbar: true,
    resizable: false,
    show: false,
    transparent: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  focusTimerWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  focusTimerWindow.on('closed', () => { focusTimerWindow = null; });

  if (VITE_DEV_SERVER_URL) {
    void focusTimerWindow.loadURL(`${VITE_DEV_SERVER_URL}?mode=focus-timer`);
  } else {
    void focusTimerWindow.loadFile(path.join(process.env.DIST!, 'index.html'), {
      query: { mode: 'focus-timer' },
    });
  }

  focusTimerWindow.once('ready-to-show', () => {
    focusTimerWindow?.show();
  });
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
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit(); } },
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


app.on('before-quit', () => {
  isQuitting = true;
  captureWindow?.destroy();
  focusTimerWindow?.destroy();
});

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
  installSecurityPolicies();
  migrateToEncrypted();
  registerAsanaHandlers();
  registerGCalHandlers();
  registerStoreHandlers();
  registerTimerHandlers();
  registerFocusHandlers();
  registerAnthropicHandlers();
  registerInkContextHandlers();
  registerChatHistoryHandlers();
  registerFinanceHandlers();
  registerStripeHandlers();
  registerCaptureHandlers(() => captureWindow, () => mainWindow);

  ipcMain.handle('window:activate', () => {
    app.focus({ steal: true });
    mainWindow?.focus();
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

  ipcMain.handle('shell:open-external', (event, url: string) => {
    try {
      assertRateLimit('shell:open-external', event.sender.id, 250);
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
      logSecurityEvent('shell.openExternal', {
        senderId: event.sender.id,
        host: parsed.host || null,
      });
    } catch {
      return;
    }
    void shell.openExternal(url);
  });

  createWindow();
  createCaptureWindow();
  createTray();

  setFocusTimerCallbacks(
    () => createFocusTimerWindow(),
    () => { focusTimerWindow?.hide(); },
  );

  globalShortcut.register('CommandOrControl+Shift+.', () => {
    if (!captureWindow) return;
    if (captureWindow.isVisible()) {
      captureWindow.hide();
    } else {
      captureWindow.show();
      captureWindow.focus();
    }
  });

  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (!focusTimerWindow || focusTimerWindow.isDestroyed()) return;
    if (focusTimerWindow.isVisible()) {
      focusTimerWindow.hide();
    } else {
      focusTimerWindow.show();
    }
  });

  ipcMain.handle('focus-timer:show', () => {
    createFocusTimerWindow();
  });

  ipcMain.handle('focus-timer:hide', () => {
    focusTimerWindow?.hide();
  });

  // Purge stale captures at midnight and on wake
  purgeStaleCapturesOnWake();
  setInterval(() => purgeStaleCapturesOnWake(), 60_000);

  // Build full native menu after mainWindow exists so IPC sends work
  const menuTemplate: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        { label: 'New Task', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu:new-task') },
        { label: 'New Event', accelerator: 'CmdOrCtrl+Shift+N', click: () => mainWindow?.webContents.send('menu:new-event') },
        { label: 'Quick Capture', accelerator: 'CmdOrCtrl+Shift+.', click: () => {
          if (!captureWindow) return;
          if (captureWindow.isVisible()) {
            captureWindow.hide();
          } else {
            captureWindow.show();
            captureWindow.focus();
          }
        }},
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Flow', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.webContents.send('menu:set-view', 'flow') },
        { label: 'Intentions', accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.webContents.send('menu:set-view', 'intentions') },
        { label: 'Plot', accelerator: 'CmdOrCtrl+3', click: () => mainWindow?.webContents.send('menu:open-plot') },
        { type: 'separator' },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: () => mainWindow?.webContents.send('menu:toggle-sidebar') },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Go',
      submenu: [
        { label: 'Today', accelerator: 'CmdOrCtrl+Shift+T', click: () => mainWindow?.webContents.send('menu:go-today') },
        { label: 'Start Day', click: () => mainWindow?.webContents.send('menu:start-day') },
        { label: 'Open Ink', accelerator: 'CmdOrCtrl+I', click: () => mainWindow?.webContents.send('menu:open-ink') },
      ],
    },
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        { label: 'Settings...', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send('menu:open-settings') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
