import { supabase } from './supabase.js';

const FIREBASE_VERSION = '10.14.1';
let firebaseReady;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find((script) => script.src === src);
    if (existing) {
      if (window.firebase?.messaging) resolve();
      else {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
      }
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load Firebase notification library.'));
    document.head.appendChild(script);
  });
}

async function getFirebaseMessaging() {
  if (!firebaseReady) {
    firebaseReady = (async () => {
      const response = await fetch('/api/firebase-config', { cache: 'no-store' });
      const config = await response.json().catch(() => ({}));
      if (!response.ok || !config.configured) {
        throw new Error(config.message || 'Firebase notifications are not configured on the website yet.');
      }

      await loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js`);
      await loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging-compat.js`);

      if (!window.firebase.apps.length) window.firebase.initializeApp(config.firebaseConfig);
      if (!window.firebase.messaging.isSupported || !(await window.firebase.messaging.isSupported())) {
        throw new Error('This browser does not support web push notifications.');
      }
      return { messaging: window.firebase.messaging(), vapidKey: config.vapidKey };
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

  const { messaging, vapidKey } = await getFirebaseMessaging();
  const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;

  const token = await messaging.getToken({ vapidKey, serviceWorkerRegistration });
  if (!token) throw new Error('Chrome did not provide a push registration. Please try again.');

  const { error } = await supabase.functions.invoke('register-push-device', {
    body: { token, userAgent: navigator.userAgent.slice(0, 500) }
  });
  if (error) throw new Error(error.message || 'Could not save this phone for order notifications.');

  // If an order arrives while the admin page is open, still show a system notification.
  messaging.onMessage((payload) => {
    const data = payload.data || {};
    const title = data.title || 'New Stationery order';
    const options = {
      body: data.body || 'A new customer order has arrived.',
      icon: '/favicon.ico',
      data: { url: data.url || '/admin' }
    };
    if (Notification.permission === 'granted') new Notification(title, options);
  });

  return true;
}
