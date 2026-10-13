'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Purge any stale service worker caches on localhost to ensure live updates
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            if (key.includes('thp-inventory')) {
              caches.delete(key);
            }
          });
        });
      }
    }

    if ('serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered with scope:', registration.scope);

            // Force check for updated sw.js file on server
            registration.update();

            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] New version installed! Purging caches and reloading app...');
                    if (window.caches) {
                      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => {
                        window.location.reload();
                      });
                    } else {
                      window.location.reload();
                    }
                  }
                };
              }
            };

            // If permission is already granted, auto-renew/update push token on server
            if ('Notification' in window && Notification.permission === 'granted') {
              import('@/utils/pushNotifications').then(({ subscribeUserToPush }) => {
                subscribeUserToPush();
              });
            }
          })
          .catch((error) => {
            console.warn('[PWA] Service Worker registration failed:', error);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
        return () => window.removeEventListener('load', registerSW);
      }
    }
  }, []);

  return null;
}
