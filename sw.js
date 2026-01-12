// Service Worker for Headless-web PWA
const CACHE_NAME = 'headless-web-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/ai-chat.html',
  '/downloader.html',
  '/profile.html',
  '/login.html',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Cache install failed:', err);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip API requests and external resources
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('/auth/') ||
      event.request.url.includes('/ai/') ||
      event.request.url.includes('/download/') ||
      !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(() => {
          // Return offline page if available
          return caches.match('/index.html');
        });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // TODO: Implement data sync logic for offline actions
  // This could include syncing chat history, downloads, profile updates, etc.
  console.log('Syncing data...');
  // Example: Send queued API requests, sync local storage with server, etc.
}

// Push notifications (optional for future use)
self.addEventListener('push', event => {
  const options = {
    body: event.data?.text() || 'New notification',
    // Note: Ensure favicon.ico exists at root, or replace with actual icon path
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification('Headless-web', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});
