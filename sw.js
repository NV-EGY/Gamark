// sw.js - Service Worker لـ GAMARK
const CACHE_VERSION = 'gamark-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = [
  // صفحات رئيسية
  '/',
  '/index.html',
  '/desktop.html',
  '/Product.html',
  '/admin-orders.html',
  // Manifests
  '/manifest.json',
  '/manifest-orders.json',
  // أيقونات
  '/images/favicon.png',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png',
  '/images/icon-or-192x192.png',
  '/images/icon-or-512x512.png',
  '/images/gamark-logo.png',
  '/images/header.webp'
];

// تثبيت: خزن الملفات الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('Some assets failed to cache:', err);
      }))
  );
  self.skipWaiting();
});

// تنشيط: احذف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// الجلب
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // لا تخزن طلبات Firebase (Firestore عنده كاش خاص)
  if (request.url.includes('firestore.googleapis.com') ||
      request.url.includes('identitytoolkit') ||
      request.url.includes('googleapis.com') ||
      request.url.includes('gstatic.com/firebasejs')) {
    return; // اتركها للشبكة/المتصفح
  }

  // HTML: network first، fallback للكاش (لضمان أحدث نسخة)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // الصور/الخطوط/CDN: cache first (أسرع)
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(res => {
      if (res.ok && request.method === 'GET') {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then(c => c.put(request, copy));
      }
      return res;
    }))
  );
});
