// js/logger.js
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore, initializeFirestore,
    persistentLocalCache, persistentMultipleTabManager,
    collection, addDoc, Timestamp, getDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA71-ZaaZj7spl6aGxH_xvCi_lmTecIwXU",
  authDomain: "gamark-d04ff.firebaseapp.com",
  projectId: "gamark-d04ff",
  storageBucket: "gamark-d04ff.firebasestorage.app",
  messagingSenderId: "802246864333",
  appId: "1:802246864333:web:23b5336c0c54280a736884",
  measurementId: "G-DNSGDRCYST"
};

// ✅ منع تكرار تهيئة Firebase App
let app;
if (getApps().length > 0) {
    app = getApp();
} else {
    app = initializeApp(firebaseConfig);
}

// 🔥 التعديل الجوهري: تهيئة Firestore مع الكاش المحلي من هنا
// لأن هذا الملف يُستورد أولاً، فسيكون هو أول من يهيّئ Firestore.
// في admin-orders.html، عندما يحاول initializeFirestore يفشل ويرجع لنفس النسخة
// هذه — التي تحتوي على persistentLocalCache.
let db;
try {
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        })
    });
    console.log('✅ [logger] Firestore initialized WITH persistence');
} catch (e) {
    // Firestore مهيأة بالفعل — استخدم النسخة الموجودة
    db = getFirestore(app);
    console.warn('⚠️ [logger] Firestore already initialized — reusing existing instance');
}

/**
 * تحويل أي قيمة إلى صيغة Firestore REST API
 */
function convertToFirestoreValue(value) {
    if (value && typeof value === 'object' && value.toDate && typeof value.toDate === 'function') {
        return { timestampValue: value.toDate().toISOString() };
    }
    if (value instanceof Date) {
        return { timestampValue: value.toISOString() };
    }
    if (value === null || value === undefined) {
        return { nullValue: null };
    }
    if (typeof value === 'string') {
        return { stringValue: value };
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
    }
    if (typeof value === 'boolean') {
        return { booleanValue: value };
    }
    if (Array.isArray(value)) {
        return {
            arrayValue: {
                values: value.map(item => convertToFirestoreValue(item))
            }
        };
    }
    if (typeof value === 'object') {
        const fields = {};
        for (const [k, v] of Object.entries(value)) {
            fields[k] = convertToFirestoreValue(v);
        }
        return { mapValue: { fields } };
    }
    return { stringValue: String(value) };
}

export async function logAuditEvent(data) {
    let performedBy = data.performedBy || window.currentUserEmail || 'system';

    const currentPath = window.location.pathname;
    const allowedPages = [
        'admin-order', 'admin-products', 'admin-product',
        'Profits', 'Audit-log', 'admin-order (1)',
        '/', '/index.html', ''
    ];
    const isAdminPage = allowedPages.some(page => currentPath.includes(page));
    if (!isAdminPage) return;

    try {
        const {
            action,
            orderId = null,
            orderNumber = null,
            details = {},
            severity = 'info'
        } = data;

        const cleanDetails = convertToFirestoreValue(details);

        const docData = {
            action: { stringValue: action },
            orderId: { stringValue: orderId || '' },
            orderNumber: { stringValue: orderNumber || '' },
            severity: { stringValue: severity || 'info' },
            details: cleanDetails,
            performedBy: { stringValue: performedBy || 'system' },
            timestamp: { timestampValue: new Date().toISOString() },
            createdAt: { timestampValue: new Date().toISOString() }
        };

        if (details.oldStatus) docData.oldStatus = { stringValue: String(details.oldStatus) };
        if (details.newStatus) docData.newStatus = { stringValue: String(details.newStatus) };
        if (details.notes) docData.notes = { stringValue: String(details.notes) };
        if (details.customerName) docData.customerName = { stringValue: String(details.customerName) };
        if (details.finalTotal !== undefined) docData.finalTotal = { doubleValue: Number(details.finalTotal) };

        // ⚠️ REST API لا يعمل أوفلاين — نتخطاه ونروح مباشرة للـ SDK
        if (!navigator.onLine) {
            throw new Error('offline');
        }

        const token = await getAuthToken();
        const projectId = "gamark-d04ff";
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/auditLog`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields: docData })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        console.log("✅ [Audit Log] تم تسجيل الحدث:", action, orderNumber);
        return await response.json();

    } catch (error) {
        // ✅ fallback عبر SDK (يدعم الأوفلاين عبر الـ queue)
        try {
            const logEntry = {
                action: data.action,
                orderId: data.orderId || null,
                orderNumber: data.orderNumber || null,
                severity: data.severity || 'info',
                details: data.details || {},
                performedBy,
                createdAt: Timestamp.now()
            };
            await addDoc(collection(db, "auditLog"), logEntry);
            console.log("✅ [Audit Log] تم التسجيل عبر SDK");
        } catch (e) {
            console.warn("⚠️ [Audit Log] فشل التسجيل تماماً:", e.message);
        }
    }
}

async function getAuthToken() {
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    const auth = getAuth();
    return new Promise((resolve, reject) => {
        if (auth.currentUser) {
            auth.currentUser.getIdToken().then(resolve).catch(reject);
        } else {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe();
                if (user) user.getIdToken().then(resolve).catch(reject);
                else reject(new Error('غير مسجل الدخول'));
            });
        }
    });
}

export function getChangedFields(oldData, newData, fields) {
    const changes = {};
    fields.forEach(field => {
        if (JSON.stringify(oldData[field]) !== JSON.stringify(newData[field])) {
            changes[field] = { old: oldData[field], new: newData[field] };
        }
    });
    return changes;
}

export { db };
