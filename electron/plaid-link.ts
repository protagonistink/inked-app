import { BrowserWindow, ipcMain } from 'electron';

export function openPlaidLink(linkToken: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 500,
      height: 700,
      title: 'Connect your bank',
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
      },
    });

    const html = `<!DOCTYPE html>
<html>
<head>
  <style>body { margin: 0; background: #0A0A0A; }</style>
  <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
</head>
<body>
  <script>
    const { ipcRenderer } = require('electron');
    const handler = Plaid.create({
      token: '${linkToken}',
      onSuccess: (publicToken) => {
        ipcRenderer.send('plaid-link:success', publicToken);
      },
      onExit: (err) => {
        ipcRenderer.send('plaid-link:exit', err ? err.error_message : null);
      },
    });
    handler.open();
  </script>
</body>
</html>`;

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    const onSuccess = (_event: unknown, publicToken: string) => {
      cleanup();
      win.close();
      resolve(publicToken);
    };

    const onExit = (_event: unknown, errorMessage: string | null) => {
      cleanup();
      win.close();
      if (errorMessage) reject(new Error(errorMessage));
      else reject(new Error('User cancelled'));
    };

    function cleanup() {
      ipcMain.removeListener('plaid-link:success', onSuccess);
      ipcMain.removeListener('plaid-link:exit', onExit);
    }

    ipcMain.once('plaid-link:success', onSuccess);
    ipcMain.once('plaid-link:exit', onExit);

    win.on('closed', () => {
      cleanup();
      reject(new Error('Window closed'));
    });
  });
}
