import { FocusView } from '@/components/focus/FocusView';

export interface FocusModeProps {
  taskId: string;
  onExit: () => void;
}

export function FocusMode({ taskId, onExit }: FocusModeProps) {
  return <FocusView taskId={taskId} onExit={onExit} />;
}
