const CACHE_NAME = 'zoona-store-cache-v1.0.0';
const API_CACHE_NAME = 'zoona-store-api-cache-v1.0.0';
const IMAGE_CACHE_NAME = 'zoona-store-images-cache-v1.0.0';

// عناوين التخزين المؤقت الثابتة (Assets)
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  // تأكد من صحة المسارات:
  '/assets/splash-logo.png',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap'
];

// ----------------------------------------------------
// 5. وظائف مساعدة (Functions) - يجب تعريفها أولاً
// ----------------------------------------------------

async function getFromCache(request) {
  const cacheNames = [CACHE_NAME, API_CACHE_NAME, IMAGE_CACHE_NAME];
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
  }
  return null;
}

async function addToCache(request, response) {
  const url = new URL(request.url);
  let cacheName = IMAGE_CACHE_NAME; // افتراضياً كاش الصور
  
  // تحديد ما إذا كان طلباً لواجهة برمجة تطبيقات (API)
  // يمكنك تغيير '/api/' إلى أي مسار API تستخدمه
  if (url.pathname.startsWith('/api/')) {
    cacheName = API_CACHE_NAME;
  } 
  // تحديد ما إذا كان طلباً لصورة
  else if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    cacheName = IMAGE_CACHE_NAME;
  }
  // التخزين في الكاش المحدد
  if (cacheName) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  }
}

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
      self.clients.claim()
    ])
  );
});

// ----------------------------------------------------
// 3. اعتراض الطلبات (Caching Strategy)
// ----------------------------------------------------
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // تجاهل طلبات OneSignal إذا لم تكن تديرها بنفسك
  if (url.hostname.includes('onesignal.com') || url.pathname.match(/OneSignalSDK/i)) {
      return;
  }

  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    (async () => {
      const cachedResponse = await getFromCache(event.request);
      if (cachedResponse) {
        // تحديث الكاش في الخلفية
        event.waitUntil(fetch(event.request).then(response => {
          if (response && response.ok) {
             addToCache(event.request, response.clone());
          }
        }));
        return cachedResponse;
      }
      
      try {
        const networkResponse = await fetch(event.request);
        
        if (networkResponse.ok && networkResponse.type === 'basic') {
          // تخزين الاستجابة في الكاش المناسب (صور، API، أو غيره)
          addToCache(event.request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
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
// * ملاحظة: بما أنك تستخدم OneSignal، فإن OneSignal SDK تتولى عادةً
//   هذه الأحداث، لكن تركها هنا لا يضر طالما لا تتعارض.

// أ. حدث استقبال الإشعار
self.addEventListener('push', event => {
  console.log('[Service Worker] Push Received.');

  const data = event.data ? event.data.json() : { title: 'إشعار جديد', body: 'تنبيه من متجر ZOONA', url: '/' };
  
  const title = data.title;
  const options = {
    body: data.body,
    icon: '/icon/icon-192x192.png', 
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
