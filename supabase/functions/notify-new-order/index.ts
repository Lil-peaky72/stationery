import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = { 'Content-Type': 'application/json' };

function base64url(input: string | Uint8Array) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToArrayBuffer(pem: string) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getGoogleAccessToken(serviceAccount: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + '.' + claim;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const assertion = unsigned + '.' + base64url(new Uint8Array(signature));
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error('Google OAuth token request failed: ' + (result.error_description || result.error || response.status));
  return result.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });

  const expectedSecret = Deno.env.get('STATIONERY_WEBHOOK_SECRET');
  const suppliedSecret = req.headers.get('x-stationery-webhook-secret');
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized webhook.' }), { status: 401, headers: corsHeaders });
  }

  const event = await req.json().catch(() => null);
  if (!event || event.type !== 'INSERT' || event.table !== 'orders' || event.schema !== 'public' || !event.record?.reference) {
    return new Response(JSON.stringify({ ignored: true }), { status: 200, headers: corsHeaders });
  }

  const serviceAccountText = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!serviceAccountText) return new Response(JSON.stringify({ error: 'Firebase service account is not configured.' }), { status: 500, headers: corsHeaders });

  let serviceAccount;
  try { serviceAccount = JSON.parse(serviceAccountText); }
  catch { return new Response(JSON.stringify({ error: 'Firebase service account secret is not valid JSON.' }), { status: 500, headers: corsHeaders }); }

  const projectId = serviceAccount.project_id;
  if (!projectId || !serviceAccount.client_email || !serviceAccount.private_key) {
    return new Response(JSON.stringify({ error: 'Firebase service account is missing required fields.' }), { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: devices, error: devicesError } = await supabase
    .from('stationery_push_devices')
    .select('token');
  if (devicesError) {
    console.error('Could not load Stationery push devices:', devicesError);
    return new Response(JSON.stringify({ error: 'Could not load registered devices.' }), { status: 500, headers: corsHeaders });
  }
  if (!devices?.length) return new Response(JSON.stringify({ sent: 0, message: 'No administrator devices are registered yet.' }), { status: 200, headers: corsHeaders });

  try {
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const order = event.record;
    const data = {
      title: 'New Stationery order',
      body: `${String(order.order_type || 'Order')} · ${String(order.reference)}`,
      reference: String(order.reference),
      url: '/admin'
    };

    let sent = 0;
    let failed = 0;
    const staleTokens: string[] = [];
    await Promise.all(devices.map(async ({ token }) => {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token, data, webpush: { headers: { Urgency: 'high' } } } })
      });
      if (response.ok) {
        sent++;
        return;
      }
      failed++;
      const errorBody = await response.json().catch(() => ({}));
      const errorCode = errorBody?.error?.details?.find((item: { errorCode?: string }) => item.errorCode)?.errorCode;
      if (response.status === 404 || errorCode === 'UNREGISTERED') staleTokens.push(token);
      console.error('FCM send failed:', response.status, errorBody?.error?.message || 'Unknown FCM error');
    }));

    if (staleTokens.length) {
      await supabase.from('stationery_push_devices').delete().in('token', staleTokens);
    }
    return new Response(JSON.stringify({ sent, failed, removedStaleTokens: staleTokens.length }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Stationery FCM notification failed:', error);
    return new Response(JSON.stringify({ error: 'Could not send push notifications.' }), { status: 500, headers: corsHeaders });
  }
});
