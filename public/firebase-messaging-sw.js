/* Firebase Cloud Messaging service worker for Stationery.
   Firebase's public web config is fetched from the Vercel API route; no private
   service-account credentials are ever sent to this file. */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const firebaseReady = fetch('/api/firebase-config', { cache: 'no-store' })
  .then((response) => {
    if (!response.ok) throw new Error('Firebase web push is not configured.');
    return response.json();
  })
  .then((config) => {
    if (!config.configured) throw new Error('Firebase web push is not configured.');
    firebase.initializeApp(config.firebaseConfig);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const data = payload.data || {};
      const title = data.title || 'New Stationery order';
      const options = {
        body: data.body || 'A new customer order has arrived.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        data: { url: data.url || '/admin' },
        tag: data.reference || 'stationery-new-order',
        renotify: true
      };
      self.registration.showNotification(title, options);
    });
    return true;
  })
  .catch((error) => {
    console.error('Stationery push worker could not initialize:', error);
    return false;
  });

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/admin', self.location.origin).href;
  event.waitUntil((async () => {
    await firebaseReady;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(target);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
