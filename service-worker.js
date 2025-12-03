// =================================================================
// 🚨 1. دمج عامل الخدمة خاص OneSignal (في الأعلى دائماً)
// =================================================================
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDKWorker.js');


// =================================================================
// 2. متغيرات التخزين المؤقت (PWA Caching Variables)
// =================================================================
const CACHE_NAME = 'zoona-store-cache-v1.0.0';
const API_CACHE_NAME = 'zoona-store-api-cache-v1.0.0';
const IMAGE_CACHE_NAME = 'zoona-store-images-cache-v1.0.0';

// الملفات التي يتم تخزينها مسبقاً
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/splash-logo.png',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap'
];


// =================================================================
// 3. وظائف مساعدة
// =================================================================

// البحث في الكاش
async function getFromCache(request) {
  const cacheNames = [CACHE_NAME, API_CACHE_NAME, IMAGE_CACHE_NAME];
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
  }
  return null;
}

// إضافة إلى الكاش
async function addToCache(request, response) {
  const url = new URL(request.url);
  let cacheName = CACHE_NAME;

  if (url.pathname.startsWith('/api/')) {
    cacheName = API_CACHE_NAME;
  } 
  else if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    cacheName = IMAGE_CACHE_NAME;
  }
  else if (url.origin === 'https://fonts.gstatic.com') {
    cacheName = CACHE_NAME;
  }

  if (response.ok || url.origin.includes('fonts')) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
}


// =================================================================
// 4. تثبيت Service Worker
// =================================================================
self.addEventListener('install', event => {
  console.log('📱 تثبيت خدمة PWA لمتجر ZOONA');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );

  self.skipWaiting();
});


// =================================================================
// 5. تفعيل Service Worker وتنظيف الكاش القديم
// =================================================================
self.addEventListener('activate', event => {
  console.log('🔄 تفعيل Service Worker لمتجر ZOONA');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME && 
              name !== API_CACHE_NAME && 
              name !== IMAGE_CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );

  self.clients.claim();
});


// =================================================================
// 6. اعتراض الطلبات (Caching Strategy)
// =================================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 🚫 استثناء تام لطلبات OneSignal
  if (url.hostname.includes('onesignal.com') || url.pathname.includes('OneSignalSDK')) {
    return; // لا تلمس هذه الطلبات
  }

  // خطوط Google
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;

        return fetch(event.request).then(response => {
          if (response.ok) addToCache(event.request, response.clone());
          return response;
        });
      })
    );
    return;
  }

  // تجاهل أي طلب ليس GET
  if (event.request.method !== 'GET') return;

  // استراتيجية Stale-While-Revalidate
  event.respondWith(
    (async () => {
      const cached = await getFromCache(event.request);

      const networkFetch = fetch(event.request)
        .then(resp => {
          if (resp.ok && resp.type === 'basic') {
            addToCache(event.request, resp.clone());
          }
          return resp;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkFetch);
        return cached;
      }

      const networkResponse = await networkFetch;
      if (networkResponse) return networkResponse;

      // في حالة عدم توفر الإنترنت
      if (event.request.headers.get('accept').includes('text/html')) {
        return caches.match('/index.html');
      }

      return new Response('متجر ZOONA - لا يوجد اتصال بالإنترنت', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    })()
  );
});


// =================================================================
// 7. ملاحظة:
// أحداث push و notificationclick يتم التعامل معها داخل
// OneSignalSDKWorker.js
// =================================================================