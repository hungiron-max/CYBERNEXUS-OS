// Self-destructing Service Worker
// Automatically unregisters any leftover zombie service worker and purges cache
self.addEventListener('install', function(event) {
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(keys.map(function(k) { return caches.delete(k); }));
        }).then(function() {
            return self.registration.unregister();
        }).then(function() {
            return self.clients.matchAll();
        }).then(function(clients) {
            clients.forEach(function(c) {
                if (c.url && 'navigate' in c) {
                    c.navigate(c.url);
                }
            });
        })
    );
});
