// sw.js - Service Worker
const CACHE_NAME = 'gamark-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/desktop.html',
  '/Product.html',
  '/images/gamark-logo.png',
  '/images/favicon.png',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png',
  '/images/header.webp'
  // يمكنك إضافة أي ملفات CSS أو JS أو صور أساسية أخرى تريد تخزينها
];

// 1. حدث التثبيت: تخزين الملفات الأساسية في الكاش
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. حدث التنشيط: حذف الكاش القديم
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. حدث الجلب (Fetch): تقديم الملفات من الكاش أولاً ثم من الشبكة
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إذا وجد الملف في الكاش، أعده
        if (response) {
          return response;
        }
        // وإلا، اجلبه من الشبكة
        return fetch(event.request).then(networkResponse => {
          // (اختياري) يمكنك تخزين استجابة جديدة في الكاش هنا
          return networkResponse;
        });
      })
  );
});
