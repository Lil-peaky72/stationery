import React, { useEffect, useState } from 'react';
import { enableOrderNotifications } from './lib/pushNotifications.js';

export default function PushNotifications({ notify }) {
  const [configured, setConfigured] = useState(null);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setSupported('Notification' in window && 'serviceWorker' in navigator && window.isSecureContext);
    fetch('/api/firebase-config', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        setConfigured(response.ok && data.configured === true);
      })
      .catch(() => setConfigured(false));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      await enableOrderNotifications();
      setEnabled(true);
      notify('Phone order notifications are enabled on this device.');
    } catch (error) {
      notify(error.message || 'Could not enable phone notifications.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel admin-push-panel">
      <div className="admin-panel-title">
        <div>
          <h2>Phone order notifications</h2>
          <p>Receive a Chrome alert when a customer submits a new order, even when Stationery is closed.</p>
        </div>
        <span className={enabled ? 'admin-online' : 'admin-offline'}>
          {enabled ? 'Enabled on this device' : 'Not enabled'}
        </span>
      </div>
      <div className="admin-push-actions">
        <button className="admin-primary" type="button" onClick={enable} disabled={busy || !supported || configured !== true || enabled}>
          {busy ? 'Enabling…' : enabled ? 'Notifications enabled' : 'Enable phone notifications'}
        </button>
        <p className="admin-help">
          {configured === null ? 'Checking notification setup…'
            : !supported ? 'Open this page in Chrome on Android over HTTPS to enable notifications.'
              : configured === false ? 'Firebase setup is not complete yet. Add the Firebase web configuration to Vercel to activate this feature.'
                : enabled ? 'This browser is registered. You can now close the website.'
                  : 'Allow notifications when Chrome asks. This setting applies to the device and browser you are using.'}
        </p>
      </div>
    </section>
  );
}
