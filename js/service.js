// Service Worker
self.addEventListener('install', (event) => {
    // Skip waiting to ensure the new service worker activates immediately.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Take control of all clients as soon as the service worker activates.
    event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
    // Close the notification when clicked.
    event.notification.close();

    // Focus the client window that opened the notification.
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            return clients.openWindow('/');
        })
    );
});