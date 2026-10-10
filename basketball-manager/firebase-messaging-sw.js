importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js');

// Service Worker for offline caching (Consolidated)
// OJO: subir CACHE_NAME en cada cambio de estrategia. El install solo vuelve a
// ejecutarse cuando cambia ESTE fichero, asi que es el unico modo de renovar.
const CACHE_NAME = 'basket-manager-v3';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    'https://unpkg.com/react@18/umd/react.development.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                console.log('[SW] Caching app shell...');
                // Cache critical local files first
                const criticalUrls = urlsToCache.filter(url => url.startsWith('./'));
                await cache.addAll(criticalUrls);

                // Attempt to cache external files individually to avoid total failure on CORS
                const externalUrls = urlsToCache.filter(url => !url.startsWith('./'));
                for (const url of externalUrls) {
                    try {
                        await cache.add(new Request(url, { mode: 'no-cors' }));
                    } catch (e) {
                        console.warn(`[SW] Failed to cache external resource: ${url}`, e);
                    }
                }
            })
            .then(() => self.skipWaiting())
    );
});

// Limpia cachés de versiones anteriores y toma el control de las pestañas ya
// abiertas, para que el cambio de estrategia surta efecto sin cerrar la app.
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

const guardarEnCache = (request, response) => {
    // Las respuestas opacas (CDN con no-cors) tienen status 0 y no se revalidan.
    if (!response || (response.status !== 200 && response.type !== 'opaque')) return;
    const copia = response.clone();
    caches.open(CACHE_NAME).then(c => c.put(request, copia)).catch(() => {});
};

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    let url;
    try { url = new URL(req.url); } catch { return; }

    // El HTML va a RED PRIMERO. Con cache-first, un despliegue nuevo nunca
    // llegaba a quien ya tuviera la app cacheada: se quedaba clavado para
    // siempre en la version del dia que la abrio por primera vez.
    const esAppShell = req.mode === 'navigate'
        || url.pathname.endsWith('/')
        || url.pathname.endsWith('.html');

    if (esAppShell) {
        event.respondWith(
            fetch(req)
                .then(res => { guardarEnCache(req, res); return res; })
                .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
        );
        return;
    }

    // El resto (librerias de CDN, manifest, iconos) sigue en cache primero:
    // son estaticos y versionados por URL, y asi la app arranca sin conexion.
    event.respondWith(
        caches.match(req).then(cached => cached || fetch(req).then(res => {
            guardarEnCache(req, res);
            return res;
        }))
    );
});

firebase.initializeApp({
    apiKey: "AIzaSyAAbaUEbPjltfQrDethVojxoxD1gj4AC0w",
    authDomain: "basketmanager-ed370.firebaseapp.com",
    projectId: "basketmanager-ed370",
    storageBucket: "basketmanager-ed370.firebasestorage.app",
    messagingSenderId: "177594386006",
    appId: "1:177594386006:web:8eef1b258c8dc6b395ddf7"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: './icon2.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

