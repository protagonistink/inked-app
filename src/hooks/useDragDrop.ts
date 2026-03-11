export const DragTypes = {
  TASK: 'task',
  BLOCK: 'block',
} as const;

export interface DragItem {
  id: string;
  title: string;
  priority?: string;
  sourceType?: 'asana' | 'gcal' | 'gmail' | 'local';
  sourceId?: string;
  blockId?: string;
  linkedTaskId?: string;
}
