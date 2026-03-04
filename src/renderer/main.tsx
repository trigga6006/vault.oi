import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { RendererCrashBoundary } from './components/app/RendererCrashBoundary';
import './styles/globals.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <RendererCrashBoundary>
      <App />
    </RendererCrashBoundary>
  </React.StrictMode>,
);
