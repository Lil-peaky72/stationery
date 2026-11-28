import { supabase } from './supabase.js';

const FIREBASE_VERSION = '12.12.1';
let firebaseReady;

async function getFirebaseMessaging() {
  if (!firebaseReady) {
    firebaseReady = (async () => {
      const response = await fetch('/api/firebase-config', { cache: 'no-store' });
      const config = await response.json().catch(() => ({}));
      if (!response.ok || !config.configured) {
        throw new Error(config.message || 'Firebase notifications are not configured on the website yet.');
      }

      // Use Firebase's current FID-based registration API rather than the deprecated
      // legacy FCM registration-token API.
      const [appSdk, messagingSdk] = await Promise.all([
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging.js`)
      ]);
      if (!(await messagingSdk.isSupported())) {
        throw new Error('This browser does not support web push notifications.');
      }
      const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(config.firebaseConfig);
      const messaging = messagingSdk.getMessaging(app);
      return { messaging, vapidKey: config.vapidKey, messagingSdk };
    })().catch((error) => {
      firebaseReady = null;
      throw error;
    });
  }
  return firebaseReady;
}

export async function enableOrderNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    throw new Error('This browser does not support web notifications. Please use Chrome on Android.');
  }
  if (!window.isSecureContext) {
    throw new Error('Notifications require the secure HTTPS Stationery website.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked in Chrome. Allow them in the site settings, then try again.'
      : 'Notification permission was not granted.');
  }

  const { messaging, vapidKey, messagingSdk } = await getFirebaseMessaging();
  const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;

  // FCM's current API returns a Firebase Installation ID through onRegistered().
  const fidReady = new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error('Firebase did not finish registering this device. Please try again.'));
    }, 20000);
    unsubscribe = messagingSdk.onRegistered(messaging, (fid) => {
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(fid);
    });
  });

  await messagingSdk.register(messaging, { vapidKey, serviceWorkerRegistration });
  const fid = await fidReady;
  if (!fid) throw new Error('Chrome did not provide a push registration. Please try again.');

  const { error } = await supabase.functions.invoke('register-push-device', {
    body: { fid, userAgent: navigator.userAgent.slice(0, 500) }
  });
  if (error) throw new Error(error.message || 'Could not save this phone for order notifications.');

  // If an order arrives while the admin page is open, still show a system notification.
  messagingSdk.onMessage(messaging, (payload) => {
    const data = payload.data || {};
    const title = data.title || 'New Stationery order';
    const options = {
      body: data.body || 'A new customer order has arrived.',
      data: { url: data.url || '/admin' }
    };
    if (Notification.permission === 'granted') new Notification(title, options);
  });

  return true;
}
