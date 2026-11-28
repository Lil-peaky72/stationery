// Deletes uploaded PDF/Word files 48 hours after the order was placed.
// The order itself (customer, pages, copies, prices, totals, status) is kept for management.
// Runs once a day from Vercel Cron (see vercel.json). Needs these Vercel environment variables:
//   CRON_SECRET                 any long random text (Vercel sends it with the cron call)
//   SUPABASE_SERVICE_ROLE_KEY   Supabase > Project Settings > API (secret, server only)
//   VITE_SUPABASE_URL           already set for the site

const RETENTION_HOURS = 48;
const BATCH = 100;

export async function cleanup({ url, serviceKey, now = Date.now(), fetchImpl = fetch }) {
  const headers = { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey };
  const cutoff = new Date(now - RETENTION_HOURS * 3600 * 1000).toISOString();
  const find = await fetchImpl(
    `${url}/rest/v1/orders?select=id,file_path&file_path=not.is.null&created_at=lt.${encodeURIComponent(cutoff)}&order=created_at.asc&limit=${BATCH}`,
    { headers }
  );
  if (!find.ok) throw new Error('Could not list orders: ' + find.status);
  const rows = (await find.json()).filter((row) => typeof row.file_path === 'string' && row.file_path);
  if (!rows.length) return { deleted: 0, remaining: false };

  const remove = await fetchImpl(`${url}/storage/v1/object/print-jobs`, {
    method: 'DELETE',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: rows.map((row) => row.file_path) })
  });
  if (!remove.ok) throw new Error('Could not delete files: ' + remove.status);

  // Only after the files are gone, clear the link. The record stays.
  const ids = rows.map((row) => row.id);
  const clear = await fetchImpl(`${url}/rest/v1/orders?id=in.(${ids.join(',')})`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ file_path: null })
  });
  if (!clear.ok) throw new Error('Could not update orders: ' + clear.status);
  return { deleted: rows.length, remaining: rows.length === BATCH };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  if (!secret || secret.length < 16 || !serviceKey || !url) {
    return res.status(500).json({ error: 'Cleanup is not configured (CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY).' });
  }
  if (req.headers.authorization !== 'Bearer ' + secret) return res.status(401).json({ error: 'Unauthorized' });
  try {
    let total = 0;
    for (let round = 0; round < 5; round += 1) {
      const result = await cleanup({ url, serviceKey });
      total += result.deleted;
      if (!result.remaining) break;
    }
    return res.status(200).json({ deleted: total });
  } catch (error) {
    console.error('Document cleanup failed', error);
    return res.status(500).json({ error: String(error.message || error) });
  }
}
