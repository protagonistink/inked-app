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
  activeThreadId: string | null;
  // Callbacks
  openAssistantPreview: () => void;
  scheduleAssistantClose: () => void;
  togglePinnedAssistant: () => void;
  closeAssistant: () => void;
  setInkStreaming: (streaming: boolean) => void;
  newChat: () => void;
  openInkChat: () => void;
  openPlanningChat: () => void;
  openWeeklyPlanningAssistant: () => void;
  setBriefingMode: (mode: 'briefing' | 'chat') => void;
  setAssistantOpen: (open: boolean) => void;
  setAssistantPinned: (pinned: boolean) => void;
  setActiveThreadId: (threadId: string | null) => void;
}

const InkAssistantContext = createContext<InkAssistantContextValue | null>(null);

export function InkAssistantProvider({
  children,
  mode,
  view,
}: {
  children: ReactNode;
  mode: string;
  view: string;
}) {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPinned, setAssistantPinned] = useState(false);
  const [inkStreaming, setInkStreaming] = useState(false);
  const [briefingSessionId, setBriefingSessionId] = useState(0);
  const [briefingMode, setBriefingMode] = useState<'briefing' | 'chat'>('briefing');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

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

  const isBriefingDay = mode === 'briefing' && view === 'day';

  const beginFreshSession = useCallback((nextMode: 'briefing' | 'chat', pinned: boolean) => {
    clearCloseTimeout();
    setBriefingMode(nextMode);
    setActiveThreadId(null);
    setBriefingSessionId((n) => n + 1);
    setAssistantOpen(true);
    setAssistantPinned(pinned);
  }, [clearCloseTimeout]);

  const openAssistantPreview = useCallback(() => {
    if (isBriefingDay) return;
    if (!assistantOpen) {
      beginFreshSession('chat', false);
      return;
    }
    clearCloseTimeout();
    setAssistantOpen(true);
  }, [assistantOpen, beginFreshSession, clearCloseTimeout, isBriefingDay]);

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
    if (isBriefingDay) return;
    if (assistantOpen) {
      clearCloseTimeout();
      setAssistantPinned(true);
      return;
    }
    beginFreshSession('chat', true);
  }, [assistantOpen, assistantPinned, beginFreshSession, clearCloseTimeout, closeAssistant, isBriefingDay]);

  const newChat = useCallback(() => {
    setActiveThreadId(null);
    setBriefingSessionId((n) => n + 1);
  }, []);

  const openInkChat = useCallback(() => {
    beginFreshSession('chat', true);
  }, [beginFreshSession]);

  const openPlanningChat = useCallback(() => {
    beginFreshSession('briefing', true);
  }, [beginFreshSession]);

  const openWeeklyPlanningAssistant = useCallback(() => {
    beginFreshSession('briefing', true);
  }, [beginFreshSession]);

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
        activeThreadId,
        openAssistantPreview,
        scheduleAssistantClose,
        togglePinnedAssistant,
        closeAssistant,
        setInkStreaming,
        newChat,
        openInkChat,
        openPlanningChat,
        openWeeklyPlanningAssistant,
        setBriefingMode,
        setAssistantOpen,
        setAssistantPinned,
        setActiveThreadId,
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
