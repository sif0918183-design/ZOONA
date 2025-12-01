const CACHE_NAME = 'zoona-store-cache-v1.0.0';
const API_CACHE_NAME = 'zoona-store-api-cache-v1.0.0';
const IMAGE_CACHE_NAME = 'zoona-store-images-cache-v1.0.0';

// عناوين التخزين المؤقت
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/splash-logo.png',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap'
];

// تثبيت Service Worker
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

// تفعيل Service Worker
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

// اعتراض الطلبات
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // تجاهل طلبات غير GET
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    (async () => {
      // محاولة استرجاع من الذاكرة المؤقتة أولاً
      const cachedResponse = await getFromCache(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // محاولة الاسترجاع من الشبكة
      try {
        const networkResponse = await fetch(event.request);
        
        // تخزين الصور فقط في الذاكرة
        if (networkResponse.ok && url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
          await addToCache(event.request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        // إذا فشل الاتصال
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

// وظائف مساعدة
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