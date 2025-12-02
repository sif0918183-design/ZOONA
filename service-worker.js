const CACHE_NAME = 'zoona-store-cache-v1.0.0';
const API_CACHE_NAME = 'zoona-store-api-cache-v1.0.0';
const IMAGE_CACHE_NAME = 'zoona-store-images-cache-v1.0.0';

// عناوين التخزين المؤقت الثابتة (Assets)
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/splash-logo.png',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap'
];

// ----------------------------------------------------
// 1. تثبيت Service Worker
// ----------------------------------------------------
self.addEventListener('install', event => {
  console.log('📱 تثبيت تطبيق ZOONA للتخزين المؤقت');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(urlsToCache)),
      self.skipWaiting()
    ])
  );
});

// ----------------------------------------------------
// 2. تفعيل Service Worker وتنظيف الكاش القديم
// ----------------------------------------------------
self.addEventListener('activate', event => {
  console.log('✅ تفعيل تخزين متجر ZOONA');
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== API_CACHE_NAME && 
                cacheName !== IMAGE_CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // يضمن أن يصبح عامل الخدمة فعالاً على الفور
      self.clients.claim()
    ])
  );
});

// ----------------------------------------------------
// 3. اعتراض الطلبات (Caching Strategy)
// ----------------------------------------------------
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    (async () => {
      const cachedResponse = await getFromCache(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      try {
        const networkResponse = await fetch(event.request);
        
        // تخزين الصور في كاش الصور
        if (networkResponse.ok && url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
          await addToCache(event.request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        // في حالة عدم الاتصال، عرض الصفحة الرئيسية المخزنة
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
        return new Response('متجر ZOONA - غير متصل بالإنترنت', {
          status: 503,
          headers: {'Content-Type': 'text/plain; charset=utf-8'}
        });
      }
    })()
  );
});

// ----------------------------------------------------
// 4. معالجة الإشعارات اللحظية (Push Notifications)
// ----------------------------------------------------

// أ. حدث استقبال الإشعار (مهم جداً!)
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Received.');

  const data = event.data ? event.data.json() : { title: 'إشعار جديد', body: 'تنبيه من متجر ZOONA', url: '/' };
  
  const title = data.title;
  const options = {
    body: data.body,
    icon: '/icon/icon-192x192.png', // تأكد من صحة مسار الأيقونة
    data: {
      url: data.url 
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ب. حدث النقر على الإشعار
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification click Received.');

  event.notification.close();

  const targetUrl = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});


// ----------------------------------------------------
// 5. وظائف مساعدة (Functions)
// ----------------------------------------------------

async function getFromCache(request) {
  const cacheNames = [CACHE_NAME, IMAGE_CACHE_NAME];
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
  }
  return null;
}

async function addToCache(request, response) {
  const url = new URL(request.url);
  let cacheName = IMAGE_CACHE_NAME;
  
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  }
}
