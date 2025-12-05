// =================================================================
// 1. دمج عامل خدمة OneSignal الصحيح (SW Version)
// =================================================================
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
} catch (e) {
  console.error("OneSignal Worker failed to load:", e);
}

// =================================================================
// 2. التخزين المؤقت (PWA Caching)
// =================================================================
const CACHE_NAME = 'zoona-store-cache-v1.0.0';
const API_CACHE_NAME = 'zoona-store-api-cache-v1.0.0';
const IMAGE_CACHE_NAME = 'zoona-store-images-cache-v1.0.0';

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/splash-logo.png',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap'
];

// =================================================================
// 3. تثبيت Service Worker
// =================================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// =================================================================
// 4. تفعيل Service Worker
// =================================================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (![CACHE_NAME, API_CACHE_NAME, IMAGE_CACHE_NAME].includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// =================================================================
// 5. منع تعارض OneSignal
// =================================================================
function isOneSignalRequest(url) {
  return (
    url.hostname.includes('onesignal.com') ||
    url.pathname.includes('OneSignalSDKWorker') ||
    url.pathname.includes('OneSignalSDKUpdaterWorker') ||
    url.pathname.includes('OneSignalSDK')
  );
}

// =================================================================
// 6. اعتراض الطلبات Fetch
// =================================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (isOneSignalRequest(url)) return;
  if (event.request.method !== 'GET') return;

  // خطوط Google — Cache First
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // استراتيجية Stale-While-Revalidate
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.ok) {
          const cloned = networkResponse.clone();
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, cloned);
        }

        if (cached) {
          event.waitUntil(Promise.resolve()); // background update
          return cached;
        }

        return networkResponse;
      } catch (err) {
        if (cached) return cached;
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
        return new Response('متجر ZOONA — غير متصل بالإنترنت', {
          status: 503,
          headers: {'Content-Type': 'text/plain; charset=utf-8'}
        });
      }
    })()
  );
});

// =================================================================
// 7. معالجة النقر على الإشعارات (فتح الروابط داخل PWA)
// =================================================================
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        // إذا التطبيق مفتوح بالفعل → ركّز عليه وافتح الرابط داخله
        if ('focus' in client) {
          client.focus();
          if (client.postMessage) {
            client.postMessage({ action: 'navigate', url: urlToOpen });
          }
          return;
        }
      }

      // إذا التطبيق غير مفتوح → افتح نافذة جديدة ضمن نطاق PWA
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// =================================================================
// 8. تحديث Badge count عند وصول إشعار
// =================================================================
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const badgeCount = data.badge || 1;

  // حاول تعيين badge (Chrome / Edge على Android)
  event.waitUntil(
    (async () => {
      if ('setAppBadge' in navigator) {
        try {
          await navigator.setAppBadge(badgeCount);
        } catch (err) {
          console.error('Badge error:', err);
        }
      }

      // عرض الإشعار
      return self.registration.showNotification(data.title || 'ZOONA', {
        body: data.message || '',
        icon: '/assets/splash-logo.png',
        badge: '/assets/splash-logo.png',
        data: { url: data.url || '/' }
      });
    })()
  );
});