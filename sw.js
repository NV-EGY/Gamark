// sw.js - نسخة محسنة
const CACHE_VERSION = 'gamark-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/desktop.html',
    '/Product.html',
    '/admin-orders.html',
    '/manifest.json',
    '/manifest-orders.json', // تأكد من وجوده
    '/images/favicon.png',
    '/images/icon-192x192.png',
    '/images/icon-512x512.png',
    '/images/icon-or-192x192.png',
    '/images/icon-or-512x512.png',
    '/images/gamark-logo.png',
    '/images/header.webp'
];

// تثبيت: خزن الملفات بشكل فردي (لا يفشل الكل بسبب ملف واحد مفقود)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then(async (cache) => {
            for (const url of PRECACHE_URLS) {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        await cache.put(url, response);
                        console.log(`✅ تم تخزين: ${url}`);
                    } else {
                        console.warn(`⚠️ فشل تخزين ${url} - الحالة: ${response.status}`);
                    }
                } catch (err) {
                    console.warn(`⚠️ تعذر تخزين ${url}:`, err.message);
                }
            }
        })
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

    if (request.url.includes('firestore.googleapis.com') ||
        request.url.includes('identitytoolkit') ||
        request.url.includes('googleapis.com') ||
        request.url.includes('gstatic.com/firebasejs')) {
        return;
    }

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
