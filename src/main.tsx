import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { QuickCaptureNote } from './components/capture/QuickCaptureNote';
import { FocusTimerWidget } from './components/focus/FocusTimerWidget';
import './styles/globals.css';

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode');

ReactDOM.createRoot(document.getElementById('root')!).render(
  mode === 'capture'
    ? <QuickCaptureNote />
    : mode === 'focus-timer'
      ? <FocusTimerWidget />
      : (
        <React.StrictMode>
          <App />
        </React.StrictMode>
      )
);
