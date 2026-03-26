import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { QuickCaptureNote } from './components/capture/QuickCaptureNote';
import './styles/globals.css';

const params = new URLSearchParams(window.location.search);

ReactDOM.createRoot(document.getElementById('root')!).render(
  params.get('mode') === 'capture'
    ? <QuickCaptureNote />
    : (
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
);
