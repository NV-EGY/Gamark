// sw.js - الإصدار v2 (مع إصلاحات Caching للـ logger)
const CACHE_VERSION = 'gamark-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/desktop.html',
    '/Product.html',
    '/admin-orders.html',
    '/manifest.json',
    '/manifest-orders.json',
    // ✅ ملفات JS الأساسية (مهمة جداً)
    '/js/logger.js',
    '/js/ui-integration.js',
    // ✅ الأيقونات
    '/images/favicon.png',
    '/images/icon-192x192.png',
    '/images/icon-512x512.png',
    '/images/icon-or-192x192.png',
    '/images/icon-or-512x512.png',
    '/images/gamark-logo.png',
    '/images/header.webp'
];

// ✅ تثبيت: خزّن الملفات بشكل فردي (لا يفشل الكل بسبب ملف واحد مفقود)
self.addEventListener('install', (event) => {
    console.log(`🔧 [SW] Installing ${CACHE_VERSION}...`);
    event.waitUntil(
        caches.open(STATIC_CACHE).then(async (cache) => {
            let successCount = 0;
            let failCount = 0;
            for (const url of PRECACHE_URLS) {
                try {
                    // ✅ bypass HTTP cache للسيرفر عشان نضمن النسخة الأحدث
                    const response = await fetch(url, { cache: 'reload' });
                    if (response.ok) {
                        await cache.put(url, response);
                        successCount++;
                        console.log(`✅ [SW] تم تخزين: ${url}`);
                    } else {
                        failCount++;
                        console.warn(`⚠️ [SW] فشل تخزين ${url} - الحالة: ${response.status}`);
                    }
                } catch (err) {
                    failCount++;
                    console.warn(`⚠️ [SW] تعذر تخزين ${url}:`, err.message);
                }
            }
            console.log(`🔧 [SW] Precache مكتمل: ${successCount} نجح، ${failCount} فشل`);
        })
    );
    self.skipWaiting();
});

// ✅ تنشيط: احذف الكاش القديم فوراً
self.addEventListener('activate', (event) => {
    console.log(`🚀 [SW] Activating ${CACHE_VERSION}...`);
    event.waitUntil(
        caches.keys().then(keys => {
            const staleCaches = keys.filter(k => !k.startsWith(CACHE_VERSION));
            console.log(`🗑️ [SW] حذف ${staleCaches.length} كاش قديم:`, staleCaches);
            return Promise.all(staleCaches.map(k => caches.delete(k)));
        })
    );
    self.clients.claim();
});

// ✅ الجلب
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // لا تخزن Firebase والـ Google APIs
    if (request.url.includes('firestore.googleapis.com') ||
        request.url.includes('identitytoolkit') ||
        request.url.includes('googleapis.com') ||
        request.url.includes('gstatic.com/firebasejs') ||
        request.url.includes('fonts.googleapis.com') ||
        request.url.includes('cdnjs.cloudflare.com')) {
        return;
    }

    // ✅ HTML: network-first (ضمان أحدث نسخة)
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

    // ✅ JS/CSS: network-first عشان التعديلات توصل بسرعة
    // (بدل cache-first اللي كان بيمنع التحديثات)
    if (request.destination === 'script' || request.destination === 'style') {
        event.respondWith(
            fetch(request)
                .then(res => {
                    if (res.ok && request.method === 'GET') {
                        const copy = res.clone();
                        caches.open(STATIC_CACHE).then(c => c.put(request, copy));
                    }
                    return res;
                })
                .catch(() => caches.match(request)) // fallback للكاش أوفلاين
        );
        return;
    }

    // ✅ الصور/الخطوط: cache-first (أسرع)
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
