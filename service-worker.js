// =================================================================
// 🚨 1. دمج عامل خدمة OneSignal الصحيح (SW Version)
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
// 5. منع تعارض OneSignal (مهم جداً)
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

  // تجاهل بالكامل طلبات OneSignal
  if (isOneSignalRequest(url)) return;

  // تجاهل طلبات غير GET
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
          const cloned = networkResponse.clone(); // clone مرة واحدة
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, cloned);
        }

        // إذا يوجد كاش، أرسله فوراً وانتظر الشبكة في الخلفية
        if (cached) {
          event.waitUntil(Promise.resolve()); // background update (networkResponse موجود)
          return cached;
        }

        return networkResponse;
      } catch (err) {
        // إذا فشلت الشبكة، استخدم الكاش أو fallback
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