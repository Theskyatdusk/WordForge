import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './App';
import './index.css';

const rootEl = document.getElementById('root')!;

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

// Remove the loading splash after React mounts
requestAnimationFrame(() => {
  const splash = document.getElementById('app-splash');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 400);
  }
});

// ============================================================
// UNREGISTER all Service Workers — prevents stale cache issues
// The Service Worker was causing users to see outdated UI even
// after server rebuilds. We remove it entirely and rely on
// proper HTTP cache-control headers from the server instead.
// ============================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => {
      reg.unregister().then(() => {
        console.info('[SW] Unregistered old service worker:', reg.scope);
      });
    });
    // Clear all caches left behind by old service workers
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
          console.info('[SW] Deleted cache:', name);
        });
      });
    }
  }).catch(() => {});
}
