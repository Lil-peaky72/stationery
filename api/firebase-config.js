// Public Firebase Web configuration for the Stationery push-notification client.
// These values identify the Firebase web app; they are not server credentials.
export default function handler(_req, res) {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    vapidKey: process.env.FIREBASE_VAPID_KEY
  };

  const required = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId', 'vapidKey'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({ configured: false, message: 'Firebase web push is not configured yet.' });
  }

  const { vapidKey, ...firebaseConfig } = config;
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return res.status(200).json({ configured: true, firebaseConfig, vapidKey });
}
