import React, { useRef } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider } from './context/AppContext';
import { PomodoroTimer } from './components/PomodoroTimer';
import { useAtmosphere } from './hooks/useAtmosphere';

function FloatingPomodoroContent() {
  const ref = useRef<HTMLDivElement>(null);
  useAtmosphere(ref);

  return (
    <div
      ref={ref}
      className="relative h-screen w-screen bg-[#111214] text-text-primary overflow-hidden rounded-3xl border border-[#2C3035] shadow-2xl flex items-center justify-center"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="atm-warm" />
        <div className="atm-cool" />
        <div className="atm-bloom" />
      </div>
      <div className="relative z-10 flex items-center justify-center w-full h-full px-4 py-4">
        <PomodoroTimer floating />
      </div>
    </div>
  );
}

function FloatingPomodoroWindow() {
  return (
    <ThemeProvider>
      <AppProvider>
        <FloatingPomodoroContent />
      </AppProvider>
    </ThemeProvider>
  );
}

const isPomodoroWindow = window.location.hash === '#/pomodoro';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPomodoroWindow ? <FloatingPomodoroWindow /> : <App />}
  </React.StrictMode>
);
