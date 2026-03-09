importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js');

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
