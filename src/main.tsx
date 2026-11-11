import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Service Worker for PWA capability and offline shell caching (SDR Standard)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        // Trigger non-blocking check for new service worker scripts
        registration.update().catch(() => {});
      })
      .catch((err) => {
        console.warn('[SDR] Service worker registration error:', err);
      });
  });
}
