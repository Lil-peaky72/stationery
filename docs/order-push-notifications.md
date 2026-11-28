# Stationery phone order notifications (Chrome / Android)

This feature adds an optional browser push alert for approved Stationery administrators. It is deliberately separate from customer checkout: the existing `orders` insert remains the source of truth, and Supabase sends the notification asynchronously after an order has been saved. A notification failure cannot cancel or block an order.

## What is included

- Firebase Cloud Messaging (FCM) web push client and root service worker.
- An administrator-only registration Edge Function.
- A separate Edge Function that receives the Supabase order-insert webhook and sends FCM messages.
- A private `stationery_push_devices` table. Browser users have no direct table privileges; trusted Edge Functions use the service role.
- The Admin > Orders & printing panel gets an **Enable phone notifications** control.
- Push messages contain only the order type and reference, not customer names, phone numbers, uploaded file names, or document contents.

No changes are made to checkout, pricing, document generation, printing, order statuses, storage, or 48-hour file cleanup.

## 1. Create/configure Firebase

1. Open [Firebase Console](https://console.firebase.google.com/) and create a project (or use an existing project).
2. Add a Web App in Project settings > General.
3. In Project settings > Cloud Messaging, generate a Web Push certificate key pair. Copy the **public VAPID key**.
4. Ensure the Firebase Cloud Messaging API is enabled for the project.
5. In Project settings > General, copy the web app config values.

Add these environment variables to the Vercel project **Stationery** for Production (and Preview if you want to test on preview deployments):

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET` (optional)
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_VAPID_KEY`

These are Firebase web-app configuration values and the public VAPID key. The `/api/firebase-config` endpoint exposes only these public values to the browser. **Never put a Firebase service-account private key in Vercel client variables or in Git.**

## 2. Create the Firebase server credential

The sender function uses Firebase Cloud Messaging HTTP v1. Create a service-account key in Google Cloud IAM for the same Firebase project and grant the service account permission to send Firebase Cloud Messaging messages (Firebase Cloud Messaging API Admin is an appropriate role). Keep the downloaded JSON private.

In Supabase Dashboard > Edge Functions > Secrets, add:

- `FIREBASE_SERVICE_ACCOUNT_JSON` = the complete service-account JSON, preferably minified to one line.
- `STATIONERY_WEBHOOK_SECRET` = a long random secret of your own choosing.

Do not commit either value to the repository or put them in Vercel frontend environment variables.

## 3. Create the database table

Run `supabase/stationery-push-notifications.sql` once in Supabase SQL Editor.

This only creates the device-token table. It does not change the existing `orders` table or its policies.

## 4. Deploy the Edge Functions

Deploy both function folders from this repository:

- `supabase/functions/register-push-device` (keep JWT verification enabled; this function checks the signed-in user against `is_stationery_admin()`).
- `supabase/functions/notify-new-order` (disable platform JWT verification; it validates the `x-stationery-webhook-secret` header itself).

With the Supabase CLI, from the repository root:

```bash
supabase functions deploy register-push-device
supabase functions deploy notify-new-order --no-verify-jwt
```

The repository includes `supabase/config.toml` with the webhook function's JWT setting. Confirm the setting in the Supabase Dashboard after deployment. Supabase automatically provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.

## 5. Configure the order webhook

In Supabase Dashboard > Database > Webhooks, create a webhook:

- Name: `stationery-new-order-push`
- Table: `public.orders`
- Event: **INSERT only**
- Type: Supabase Edge Function (or HTTP request)
- Function: `notify-new-order`
- Add HTTP header: `x-stationery-webhook-secret` = the exact same value saved as `STATIONERY_WEBHOOK_SECRET`.

If configuring it as a raw HTTP request, use:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/notify-new-order`

The webhook runs after the order insert and is asynchronous. Do not add UPDATE events; status changes should not generate new-order alerts.

## 6. Enable it on the Android phone

1. Wait for the Vercel deployment after adding the Firebase web variables.
2. On the Android phone, open the production Stationery website in Chrome over HTTPS.
3. Sign in at `/admin` using the approved administrator account.
4. Open the **Orders & printing** tab and tap **Enable phone notifications**.
5. Choose **Allow** when Chrome asks.
6. Place a small test order from another browser/device. The phone should receive a notification. Tapping it opens `/admin`.

The website does not need to remain open after registration. The phone does need an internet connection, and Chrome/site notifications must remain allowed.

## Troubleshooting

- If the admin panel says Firebase is not configured, check all required Vercel variables and redeploy.
- If the browser says notifications are blocked, open Android Settings > Apps > Chrome > Notifications, and also check Chrome > Site settings > Notifications for the Stationery domain.
- If registration fails, confirm the SQL file ran and that both Edge Functions are deployed. The registering account must pass `is_stationery_admin()`.
- If device registration works but no order alert arrives, check the Database Webhook delivery logs and the `notify-new-order` Edge Function logs. Verify the webhook secret matches exactly and that the service-account project ID matches the Firebase project.
- If FCM reports permission errors, check that Firebase Cloud Messaging API is enabled and the service account has permission to send FCM messages.

## Cost and privacy

FCM itself does not charge per push message. Firebase quotas and Google Cloud service conditions still apply. Supabase Edge Function invocations and database webhook activity count toward the existing Supabase project usage.

Only administrators who are signed in and pass the existing admin allowlist can register a device. Device tokens are kept in a private table. The push notification includes only the order reference and order type; open the authenticated admin dashboard to see customer details.
