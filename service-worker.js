// =================================================================
// 🚨 1. الدمج الإجباري لعامل الخدمة الخاص بـ OneSignal
// هذا السطر ضروري ليعمل ServiceWorkerPath في كود بلوجر.
// =================================================================
try {
  importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js');
} catch (e) {
  // هذا يمنع تعطل عامل الخدمة في حالة فشل تحميل سكربت OneSignal
  console.error("OneSignal Worker failed to load:", e);
}


// =================================================================
// 2. متغيرات التخزين المؤقت (PWA Caching Variables)
// =================================================================
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
// 3. وظائف مساعدة (Functions)
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
  let cacheName = CACHE_NAME; // الافتراضي هو الكاش الثابت
  
  // تحديد ما إذا كان طلباً لواجهة برمجة تطبيقات (API)
  if (url.pathname.startsWith('/api/')) {
    cacheName = API_CACHE_NAME;
  } 
  // تحديد ما إذا كان طلباً لصور
  else if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    cacheName = IMAGE_CACHE_NAME;
  }
  // تخزين ملفات خطوط Google الفعلية (من نطاق gstatic.com)
  else if (url.origin === 'https://fonts.gstatic.com') {
    cacheName = CACHE_NAME;
  }

  // التخزين في الكاش المحدد
  if (cacheName) {
    // التحقق من صحة الاستجابة قبل التخزين (HTTP 200)
    if (response.ok || url.origin === 'https://fonts.gstatic.com' || url.origin === 'https://fonts.googleapis.com') {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone()); 
    }
  }
}

// ----------------------------------------------------
// 4. تثبيت Service Worker
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
// 5. تفعيل Service Worker وتنظيف الكاش القديم
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
// 6. اعتراض الطلبات (Caching Strategy)
// ----------------------------------------------------
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // لا تقم بمعالجة طلبات OneSignal هنا (تجنب التعارض)
  if (url.hostname.includes('onesignal.com') || url.pathname.match(/OneSignalSDK/i)) {
      return;
  }
  
  // معالجة طلبات خطوط Google (Cache First)
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(caches.match(event.request)
      .then(cachedResponse => {
        // Cache First (الاستراتيجية الأفضل للخطوط)
        if (cachedResponse) return cachedResponse;
        
        return fetch(event.request).then(response => {
          if (response && response.ok) {
            addToCache(event.request, response.clone());
          }
          return response;
        });
      })
    );
    return;
  }
  
  // تجاهل طلبات غير GET
  if (event.request.method !== 'GET') return;
  
  // إستراتيجية Stale-While-Revalidate الافتراضية لبقية الأصول
  event.respondWith(
    (async () => {
      const cachedResponse = await getFromCache(event.request);
      
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse.ok && networkResponse.type === 'basic') {
          addToCache(event.request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(error => {
        throw error;
      });

      if (cachedResponse) {
        event.waitUntil(fetchPromise);
        return cachedResponse;
      }
      
      try {
        return await fetchPromise;
      } catch (error) {
        // في حالة فشل الشبكة وعدم وجود كاش: Fallback
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
// 7. ملاحظة حول الإشعارات اللحظية
// ----------------------------------------------------
// تمت إزالة أكواد معالجة أحداث 'push' و 'notificationclick' الخاصة بك
// لأنها يتم التعامل معها الآن بواسطة ملف 'OneSignalSDKWorker.js' المستورد أعلاه.
