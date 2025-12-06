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
  if (event.request.method !== 'GET') return;

  // Google Fonts cache-first
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
        // 💡 التعديل هنا: يجب استنساخ res قبل تمريره للتخزين المؤقت، ثم إرجاع الأصل
        if (res.ok) {
          const cacheResponse = res.clone(); // استنساخ الاستجابة للتخزين المؤقت
          caches.open(CACHE_NAME).then(c => c.put(event.request, cacheResponse));
        }
        return res; // إرجاع الاستجابة الأصلية للمتصفح
      }))
    );
    return;
  }

  // Stale-While-Revalidate
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    try {
      const networkResponse = await fetch(event.request);
      
      // 💡 التعديل هنا: يجب استنساخ networkResponse قبل تمريره للتخزين المؤقت
      if (networkResponse && networkResponse.ok) {
        const cacheResponse = networkResponse.clone(); // استنساخ الاستجابة للتخزين المؤقت
        // لا نحتاج لـ await هنا، فقط نطلق العملية
        caches.open(CACHE_NAME).then(c => c.put(event.request, cacheResponse));
      }
      return cached || networkResponse; // إرجاع الاستجابة الأصلية للمتصفح أو المخزنة
    } catch {
      if (cached) return cached;
      if (event.request.headers.get('accept')?.includes('text/html')) return caches.match(OFFLINE_FALLBACK_URL);
      return new Response('متجر ZOONA — غير متصل بالإنترنت', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }});
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