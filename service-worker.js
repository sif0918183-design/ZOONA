// =================================================================
// ZOONA PWA + FCM Service Worker
// =================================================================
// 1️⃣ Firebase Messaging
// استخدام أحدث إصدار 12.6.0
importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBxQLDLqr4W3lApfYLPjSV5It7925a9Rr0",
  authDomain: "double-carport-476915-j7.firebaseapp.com",
  projectId: "double-carport-476915-j7",
  storageBucket: "double-carport-476915-j7.firebasestorage.app",
  messagingSenderId: "122641462099",
  appId: "1:122641462099:web:345b777a88757d3ef7e7a6"
});

const messaging = firebase.messaging();

// =================================================================
// 2️⃣ PWA Caching
// =================================================================
const CACHE_NAME = 'zoona-store-cache-v1.0.0';
const API_CACHE_NAME = 'zoona-store-api-cache-v1.0.0';
const IMAGE_CACHE_NAME = 'zoona-store-images-cache-v1.0.0';
const OFFLINE_FALLBACK_URL = '/p/offline.html';

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/splash-logo.png',
  OFFLINE_FALLBACK_URL,
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap'
];

// 3️⃣ Install SW
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
  self.skipWaiting();
});

// 4️⃣ Activate SW
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => ![CACHE_NAME, API_CACHE_NAME, IMAGE_CACHE_NAME].includes(key) && caches.delete(key))
    ))
  );
  self.clients.claim();
});

// =================================================================
// 5️⃣ Fetch (Offline Support) - الكود المعدل
// =================================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isNavigationRequest = event.request.mode === 'navigate';
  
  // تجاهل طلبات غير GET
  if (event.request.method !== 'GET') return;

  // Google Fonts cache-first
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        
        return fetch(event.request).then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          // يمكنك إرجاع رد افتراضي للخطوط
          return new Response('', {
            status: 408,
            statusText: 'الخطوط غير متوفرة حالياً'
          });
        });
      })
    );
    return;
  }

  // Stale-While-Revalidate للطلبات الأخرى
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(event.request);
    
    // تحديث ذكي في الخلفية
    const fetchPromise = fetch(event.request).then(async networkResponse => {
      if (networkResponse && networkResponse.ok) {
        const responseClone = networkResponse.clone();
        await cache.put(event.request, responseClone);
      }
      return networkResponse;
    }).catch(() => {
      // تجاهل الأخطاء في تحديث الخلفية
      return null;
    });

    // إذا كان طلب تصفح (صفحة HTML) والعملية متصلة
    if (isNavigationRequest) {
      try {
        const networkResponse = await fetchPromise;
        if (networkResponse && networkResponse.ok) {
          return networkResponse;
        }
        
        // إذا فشل طلب الشبكة، حاول استخدام المحفوظ
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // إذا لم يكن هناك محفوظ، ارجع إلى صفحة OFFLINE_FALLBACK_URL
        const offlinePage = await cache.match('/p/offline.html');
        if (offlinePage) {
          return offlinePage;
        }
        
        // رد افتراضي إذا لم توجد صفحة OFFLINE
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>غير متصل بالإنترنت - ZOONA SD</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              h1 { color: #333; }
              p { color: #666; }
            </style>
          </head>
          <body>
            <h1>عذراً، أنت غير متصل بالإنترنت</h1>
            <p>يرجى التحقق من اتصالك بالشبكة وحاول مرة أخرى.</p>
            <p>متجر ZOONA SD</p>
          </body>
          </html>
        `, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      } catch (error) {
        // معالجة الأخطاء هنا
        const offlinePage = await cache.match('/p/offline.html');
        return offlinePage || new Response('غير متصل بالإنترنت', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    }
    
    // للطلبات غير التصفحية (صور، CSS، JS، إلخ)
    try {
      const networkResponse = await fetch(event.request);
      if (networkResponse.ok) {
        const responseClone = networkResponse.clone();
        cache.put(event.request, responseClone);
      }
      return cachedResponse || networkResponse;
    } catch (error) {
      return cachedResponse || new Response('الملف غير متوفر حالياً', {
        status: 408,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  })());
});


// =================================================================
// 6️⃣ Notification Click
// =================================================================
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          client.focus();
          client.navigate(urlToOpen);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});

// =================================================================
// 7️⃣ FCM Push Notifications + Badge
// =================================================================
messaging.onBackgroundMessage(payload => {
  const title = payload.notification.title || 'ZOONA';
  const options = {
    body: payload.notification.body || '',
    icon: '/assets/splash-logo.png',
    badge: '/assets/splash-logo.png',
    data: { url: payload.fcmOptions?.link || '/' }
  };

  // تحديث الرقم على أيقونة التطبيق (Badge)
  if ('setAppBadge' in self) {
    self.setAppBadge((payload.data?.badge) || 1).catch(console.error);
  }

  self.registration.showNotification(title, options);
});

// =================================================================
// 8️⃣ Background / Periodic Sync (Optional)
// =================================================================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-zoona-data') event.waitUntil(Promise.resolve());
});
self.addEventListener('periodicsync', event => {
  if (event.tag === 'fetch-latest-products') event.waitUntil(Promise.resolve());
});