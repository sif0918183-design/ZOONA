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
const CACHE_NAME = 'zoona-store-cache-v2.0.0';
const API_CACHE_NAME = 'zoona-store-api-cache-v2.0.0';
const IMAGE_CACHE_NAME = 'zoona-store-images-cache-v2.0.0';
const OFFLINE_FALLBACK_URL = '/p/offline.html';

const urlsToCache = [
  '/',
  '/index.html',
  '/products.json',
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
// 5️⃣ Fetch (Offline Support) - Network-First Strategy
// =================================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // تجاهل طلبات غير GET والطلبات الخارجية غير المقصودة
  if (event.request.method !== 'GET') return;

  // 1. API Requests: Network-First
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(API_CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Google Fonts: Cache-First
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Navigation & Other Assets: Network-First with Offline Fallback
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        // إذا كان طلب تصفح وفشل، ارجع إلى صفحة التوقف
        if (event.request.mode === 'navigate') {
          const offlinePage = await caches.match('/p/offline.html');
          return offlinePage || new Response(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head><meta charset="utf-8"><title>غير متصل</title></head>
            <body style="font-family:sans-serif;text-align:center;padding:50px;">
              <h1>أنت غير متصل بالإنترنت</h1>
              <p>يرجى التحقق من اتصالك بالشبكة.</p>
            </body>
            </html>
          `, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        
        return new Response('غير متوفر حالياً', { status: 503 });
      })
  );
});


// =================================================================
// 6️⃣ Standard Push API
// =================================================================
self.addEventListener('push', function(event) {
  const data = event.data.json();

  self.registration.showNotification(data.notification.title, {
    body: data.notification.body,
    icon: data.notification.icon || '/assets/splash-logo.png',
    vibrate: [100, 50, 100],
    data: data.data,
    requireInteraction: false
  });
});

// =================================================================
// 7️⃣ Notification Click (مدمج لجميع أنواع الإشعارات)
// =================================================================
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});

// =================================================================
// 8️⃣ FCM Push Notifications + Badge
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
// 9️⃣ Background / Periodic Sync (Optional)
// =================================================================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-zoona-data') event.waitUntil(Promise.resolve());
});
self.addEventListener('periodicsync', event => {
  if (event.tag === 'fetch-latest-products') event.waitUntil(Promise.resolve());
});