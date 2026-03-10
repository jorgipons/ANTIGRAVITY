importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js');

// Service Worker for offline caching (Consolidated)
const CACHE_NAME = 'basket-manager-v2';
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

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
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

