import { createClient } from '@supabase/supabase-js';

const BUCKET = 'print-jobs';
const RETENTION_HOURS = 48;
const BATCH_SIZE = 100;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Missing Supabase server environment configuration' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000).toISOString();

  const { data: expired, error: queryError } = await supabase
    .from('orders')
    .select('id, file_path')
    .not('printed_at', 'is', null)
    .lte('printed_at', cutoff)
    .not('file_path', 'is', null)
    .order('printed_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (queryError) {
    console.error('Document retention query failed:', queryError.message);
    return res.status(500).json({ error: 'Could not find expired documents' });
  }

  if (!expired?.length) {
    return res.status(200).json({ ok: true, cutoff, deleted: 0, message: 'No expired documents' });
  }

  const paths = expired.map((order) => order.file_path);
  const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
  if (storageError) {
    console.error('Document storage cleanup failed:', storageError.message);
    return res.status(500).json({ error: 'Could not delete expired document files' });
  }

  const deletedAt = new Date().toISOString();
  const updates = await Promise.all(expired.map((order) =>
    supabase.from('orders')
      .update({ file_path: null, file_deleted_at: deletedAt })
      .eq('id', order.id)
      .eq('file_path', order.file_path)
  ));

  const updateErrors = updates.filter((result) => result.error);
  if (updateErrors.length) {
    console.error('Some document cleanup records could not be updated:', updateErrors.map((result) => result.error.message));
  }

  const updated = updates.length - updateErrors.length;
  return res.status(updateErrors.length ? 207 : 200).json({
    ok: updateErrors.length === 0,
    cutoff,
    examined: expired.length,
    deleted: updated,
    recordUpdateFailures: updateErrors.length
  });
}
