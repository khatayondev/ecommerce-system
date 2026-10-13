const CACHE_NAME = 'thp-inventory-v12';

// Core routes to pre-cache for offline navigation
const CORE_ROUTES = [
  '/',
  '/blog',
  '/pos',
  '/orders',
  '/invoices',
  '/receipts',
  '/logs',
  '/inventory',
  '/finances',
  '/customers',
  '/communications',
  '/suppliers',
  '/exhibitions',
  '/promos',
  '/reports',
  '/settings/users',
  '/login',
  '/icon.png'
];

// Install Event: Pre-cache app shell and core routes
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline routes and static assets');
      return cache.addAll(CORE_ROUTES).catch((err) => {
        console.warn('[ServiceWorker] Some route pre-cache items skipped:', err);
      });
    })
  );
});

// Activate Event: Clean up outdated cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-first for navigation & static assets with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and Firebase / external API endpoints from SW interceptor
  if (request.method !== 'GET') return;
  if (url.origin.includes('firestore.googleapis.com') || 
      url.origin.includes('identitytoolkit.googleapis.com') ||
      url.origin.includes('paystack') ||
      url.pathname.startsWith('/api/')) {
    return;
  }

  // On localhost/dev, bypass Service Worker caching for navigation and assets so updates are always live
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return;
  }

  // 1. Navigation requests (clicking links, opening pages offline)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline Fallback: Serve matching route from cache or home fallback
          console.log('[ServiceWorker] Offline mode: serving route from cache:', request.url);
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          
          const pathResponse = await caches.match(url.pathname);
          if (pathResponse) return pathResponse;

          const homeResponse = await caches.match('/');
          if (homeResponse) return homeResponse;

          return new Response('Offline - Page not available', {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // 2. Next.js static JS/CSS chunks & static assets (Network-first with Cache Fallback)
  if (url.pathname.startsWith('/_next/static/') || url.pathname.match(/\.(png|jpg|jpeg|svg|gif|ico|css|js)$/)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. General requests default: network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// 4. Push Event Handler: Displays mobile system notification on lockscreen/shade
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push event received:', event);

  let data = {
    title: '🛒 New Order Received!',
    body: 'A new order has just been placed at The Honey Palace.',
    icon: '/assets/honey-palace-logo.png',
    badge: '/assets/honey-palace-logo.png',
    url: '/orders',
    orderId: ''
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const notificationTag = data.orderId ? `order-${data.orderId}` : `alert-${Date.now()}`;

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [200, 100, 200, 100, 200],
    tag: notificationTag,
    renotify: true,
    data: { url: data.url || '/orders' }
  };

  // Update App Icon Badge if supported
  if ('setAppBadge' in self.navigator) {
    self.navigator.setAppBadge().catch((err) => {
      console.warn('[ServiceWorker] Failed to set app icon badge:', err);
    });
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 5. Notification Click Handler: Opens mobile PWA app screen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/orders';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
