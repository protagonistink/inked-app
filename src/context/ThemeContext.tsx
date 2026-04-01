import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'focus';
type PreferredThemeMode = Exclude<ThemeMode, 'focus'>;

const PREFERENCES_UPDATED_EVENT = 'preferences-updated';

interface ThemeContextValue {
  mode: ThemeMode;
  preferredMode: PreferredThemeMode;
  setPreferredMode: (mode: PreferredThemeMode) => void;
  enterFocusMode: () => void;
  exitFocusMode: () => void;
  isFocus: boolean;
  isLight: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  preferredMode: 'dark',
  setPreferredMode: () => {},
  enterFocusMode: () => {},
  exitFocusMode: () => {},
  isFocus: false,
  isLight: false,
});

function readCachedTheme(): PreferredThemeMode {
  try {
    const cached = localStorage.getItem('inked-theme');
    if (cached === 'light') return 'light';
  } catch { /* noop */ }
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preferredMode, setPreferredModeState] = useState<PreferredThemeMode>(readCachedTheme);
  const [focusActive, setFocusActive] = useState(false);
  const mode = focusActive ? 'focus' : preferredMode;

  const setPreferredMode = useCallback((next: PreferredThemeMode) => {
    setPreferredModeState(next);
    try { localStorage.setItem('inked-theme', next); } catch { /* noop */ }
    void window.api.settings.save({ themeMode: next });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  useEffect(() => {
    let cancelled = false;

    void window.api.settings.load()
      .then((settings) => {
        if (!cancelled) {
          setPreferredModeState(settings.ui.themeMode);
          try { localStorage.setItem('inked-theme', settings.ui.themeMode); } catch { /* noop */ }
        }
      })
      .catch(() => {
        // Keep dark mode as the fallback when settings are unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handlePreferencesUpdated(event: Event) {
      const detail = (event as CustomEvent<{ themeMode?: PreferredThemeMode }>).detail;
      if (detail?.themeMode) {
        setPreferredModeState(detail.themeMode);
      }
    }

    window.addEventListener(PREFERENCES_UPDATED_EVENT, handlePreferencesUpdated as EventListener);
    return () => window.removeEventListener(PREFERENCES_UPDATED_EVENT, handlePreferencesUpdated as EventListener);
  }, []);

  const enterFocusMode = useCallback(() => setFocusActive(true), []);
  const exitFocusMode = useCallback(() => setFocusActive(false), []);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    preferredMode,
    setPreferredMode,
    enterFocusMode,
    exitFocusMode,
    isFocus: mode === 'focus',
    isLight: mode === 'light',
  }), [mode, preferredMode, enterFocusMode, exitFocusMode, setPreferredMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
