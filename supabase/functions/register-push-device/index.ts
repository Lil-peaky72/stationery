import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });

  const authorization = req.headers.get('Authorization') || '';
  const jwt = authorization.replace(/^Bearer\\s+/i, '');
  if (!jwt) return new Response(JSON.stringify({ error: 'Sign in as an administrator first.' }), { status: 401, headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Your administrator session is invalid. Sign in again.' }), { status: 401, headers: corsHeaders });
  }

  const { data: isAdmin, error: adminError } = await userClient.rpc('is_stationery_admin');
  if (adminError || isAdmin !== true) {
    return new Response(JSON.stringify({ error: 'Only an approved Stationery administrator can register a device.' }), { status: 403, headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));
  const fid = typeof body.fid === 'string' ? body.fid.trim() : '';
  if (fid.length < 10 || fid.length > 256) {
    return new Response(JSON.stringify({ error: 'Invalid Firebase installation ID.' }), { status: 400, headers: corsHeaders });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const now = new Date().toISOString();
  const { error: saveError } = await adminClient.from('stationery_push_devices').upsert({
    user_id: userData.user.id,
    fid,
    user_agent: typeof body.userAgent === 'string' ? body.userAgent.slice(0, 500) : null,
    updated_at: now,
    last_seen_at: now
  }, { onConflict: 'fid' });

  if (saveError) {
    console.error('Could not save Stationery push device:', saveError);
    return new Response(JSON.stringify({ error: 'Could not save this device for notifications.' }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
});
