import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store();

const ASANA_BASE_URL = 'https://app.asana.com/api/1.0';

export async function asanaFetch(path: string, options: RequestInit = {}) {
  const token = store.get('asana.token') as string;
  if (!token) throw new Error('Asana token not configured. Go to Settings.');

  const response = await fetch(`${ASANA_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Asana API error ${response.status}: ${error}`);
  }

  return response.json();
}

export function registerAsanaHandlers() {
  ipcMain.handle('asana:get-tasks', async (_event, options?: { daysAhead?: number; limit?: number }) => {
    try {
      const me = await asanaFetch('/users/me');
      const workspaceId = me.data.workspaces[0]?.gid;
      if (!workspaceId) throw new Error('No Asana workspace found');
      const limit = options?.limit || 50;

      const result = await asanaFetch(
        `/tasks?assignee=me&workspace=${workspaceId}&completed_since=now&opt_fields=gid,name,completed,due_on,projects.gid,projects.name,tags.gid,tags.name,notes,custom_fields.name,custom_fields.display_value&limit=${limit}`
      );
      return { success: true, data: result.data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle(
    'asana:add-comment',
    async (_event, taskId: string, text: string) => {
      try {
        const result = await asanaFetch(`/tasks/${taskId}/stories`, {
          method: 'POST',
          body: JSON.stringify({ data: { text } }),
        });
        return { success: true, data: result.data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }
  );
}
