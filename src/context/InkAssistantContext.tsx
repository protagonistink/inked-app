import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const ASSISTANT_CLOSE_DELAY_MS = 140;

interface InkAssistantContextValue {
  // State
  assistantOpen: boolean;
  assistantPinned: boolean;
  inkStreaming: boolean;
  briefingSessionId: number;
  briefingMode: 'briefing' | 'chat';
  // Callbacks
  openAssistantPreview: () => void;
  scheduleAssistantClose: () => void;
  togglePinnedAssistant: () => void;
  closeAssistant: () => void;
  setInkStreaming: (streaming: boolean) => void;
  newChat: () => void;
  openWeeklyPlanningAssistant: () => void;
  setBriefingMode: (mode: 'briefing' | 'chat') => void;
  setAssistantOpen: (open: boolean) => void;
  setAssistantPinned: (pinned: boolean) => void;
}

const InkAssistantContext = createContext<InkAssistantContextValue | null>(null);

export function InkAssistantProvider({
  children,
  mode,
}: {
  children: ReactNode;
  mode: string;
}) {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPinned, setAssistantPinned] = useState(false);
  const [inkStreaming, setInkStreaming] = useState(false);
  const [briefingSessionId, setBriefingSessionId] = useState(0);
  const [briefingMode, setBriefingMode] = useState<'briefing' | 'chat'>('briefing');

  const closeTimeoutRef = useRef<number | null>(null);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const closeAssistant = useCallback(() => {
    clearCloseTimeout();
    setAssistantPinned(false);
    setAssistantOpen(false);
  }, [clearCloseTimeout]);

  const openAssistantPreview = useCallback(() => {
    if (mode === 'briefing') return;
    clearCloseTimeout();
    setBriefingMode('chat');
    setAssistantOpen(true);
  }, [clearCloseTimeout, mode]);

  const scheduleAssistantClose = useCallback(() => {
    if (assistantPinned) return;
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setAssistantOpen(false);
    }, ASSISTANT_CLOSE_DELAY_MS);
  }, [assistantPinned, clearCloseTimeout]);

  const togglePinnedAssistant = useCallback(() => {
    if (assistantPinned) {
      closeAssistant();
      return;
    }
    if (mode === 'briefing') return;
    clearCloseTimeout();
    setBriefingMode('chat');
    setAssistantOpen(true);
    setAssistantPinned(true);
  }, [assistantPinned, closeAssistant, clearCloseTimeout, mode]);

  const newChat = useCallback(() => {
    setBriefingSessionId((n) => n + 1);
  }, []);

  const openWeeklyPlanningAssistant = useCallback(() => {
    clearCloseTimeout();
    setBriefingMode('briefing');
    setBriefingSessionId((n) => n + 1);
    setAssistantOpen(true);
    setAssistantPinned(true);
  }, [clearCloseTimeout]);

  // Cleanup timeout on unmount
  useEffect(() => () => clearCloseTimeout(), [clearCloseTimeout]);

  return (
    <InkAssistantContext.Provider
      value={{
        assistantOpen,
        assistantPinned,
        inkStreaming,
        briefingSessionId,
        briefingMode,
        openAssistantPreview,
        scheduleAssistantClose,
        togglePinnedAssistant,
        closeAssistant,
        setInkStreaming,
        newChat,
        openWeeklyPlanningAssistant,
        setBriefingMode,
        setAssistantOpen,
        setAssistantPinned,
      }}
    >
      {children}
    </InkAssistantContext.Provider>
  );
}

export function useInkAssistant(): InkAssistantContextValue {
  const ctx = useContext(InkAssistantContext);
  if (!ctx) throw new Error('useInkAssistant must be used within InkAssistantProvider');
  return ctx;
}
