import express from 'express';
import cors from 'cors';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { timingSafeEqual } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT || 4317);
const TOKEN = process.env.STATIONERY_PRINT_TOKEN || '';
const SUPABASE_URL = process.env.STATIONERY_SUPABASE_URL || '';
const SUMATRA = process.env.SUMATRA_PDF || 'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe';
const ALLOWED_ORIGINS = (process.env.STATIONERY_ALLOWED_ORIGINS || 'https://stationery-peaky7.vercel.app,http://localhost:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const PAPER_SIZES = ['A4', 'A3', 'Letter', 'Legal'];

// --- Start-up checks: refuse to run in an unsafe configuration -------------------

if (TOKEN.length < 24) {
  console.error('STATIONERY_PRINT_TOKEN must be set to a long random value (at least 24 characters).');
  process.exit(1);
}

let supabaseHost;
try {
  const parsed = new URL(SUPABASE_URL);
  if (parsed.protocol !== 'https:') throw new Error('not https');
  supabaseHost = parsed.host;
} catch {
  console.error('STATIONERY_SUPABASE_URL must be set to your Supabase project URL, for example https://abcd1234.supabase.co');
  process.exit(1);
}

// --- Helpers -------------------------------------------------------------------

function tokenMatches(provided) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The agent only downloads PDFs from this project's private print-jobs bucket.
function isAllowedPdfUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.host === supabaseHost
      && url.pathname.startsWith('/storage/v1/object/sign/print-jobs/');
  } catch {
    return false;
  }
}

async function listPrinters() {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-Command', 'Get-Printer | Select-Object Name,PrinterStatus,PortName | ConvertTo-Json -Compress'],
    { windowsHide: true, timeout: 20000 }
  );
  const data = stdout.trim() ? JSON.parse(stdout) : [];
  return (Array.isArray(data) ? data : [data]).map((printer) => ({
    name: printer.Name,
    status: printer.PrinterStatus,
    port: printer.PortName
  }));
}

// Print jobs run one at a time, even if several requests arrive together.
let queue = Promise.resolve();
function enqueue(job) {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

// --- Server --------------------------------------------------------------------

const app = express();

// Only answer requests addressed to the local machine (blocks DNS-rebinding tricks).
const LOCAL_HOSTS = [`127.0.0.1:${PORT}`, `localhost:${PORT}`];
app.use((req, res, next) => {
  if (!LOCAL_HOSTS.includes(req.headers.host)) return res.status(403).json({ error: 'Forbidden host' });
  next();
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});
app.use(cors({
  origin: ALLOWED_ORIGINS,
  allowedHeaders: ['Content-Type', 'x-stationery-token'],
  methods: ['GET', 'POST', 'OPTIONS']
}));
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  if (!tokenMatches(req.headers['x-stationery-token'])) return res.status(401).json({ error: 'Invalid print-agent token' });
  next();
});

app.get('/health', (req, res) => res.json({ ok: true, platform: 'Windows' }));

app.get('/printers', async (req, res) => {
  try {
    res.json({ printers: await listPrinters() });
  } catch (error) {
    res.status(500).json({ error: 'Could not list Windows printers: ' + error.message });
  }
});

app.post('/print', (req, res) => {
  const { url, printerName, copies = 1, paper = 'A4', color = 'Black & white' } = req.body || {};

  if (!url || !printerName) return res.status(400).json({ error: 'PDF URL and printer are required' });
  if (!isAllowedPdfUrl(url)) return res.status(400).json({ error: 'Only signed PDF links from your Stationery storage are accepted' });

  const count = Math.max(1, Math.min(20, Number(copies) || 1));
  const settings = [
    'paper=' + (PAPER_SIZES.includes(paper) ? paper : 'A4'),
    'copies=' + count,
    color === 'Colour' ? 'color' : 'monochrome'
  ].join(',');

  enqueue(async () => {
    let dir;
    try {
      // Only print to a printer Windows actually has installed.
      const installed = await listPrinters();
      if (!installed.some((printer) => printer.name === printerName)) {
        return res.status(400).json({ error: 'That printer is not installed on this computer' });
      }

      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error('Could not download PDF (' + response.status + ')');
      if (Number(response.headers.get('content-length') || 0) > MAX_PDF_BYTES) throw new Error('PDF exceeds 20 MB');

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_PDF_BYTES) throw new Error('PDF exceeds 20 MB');
      if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('Uploaded file is not a valid PDF');

      dir = await mkdtemp(path.join(tmpdir(), 'stationery-'));
      const file = path.join(dir, 'job.pdf');
      await writeFile(file, bytes);

      await execFileAsync(
        SUMATRA,
        ['-print-to', printerName, '-print-settings', settings, '-silent', '-exit-on-print', file],
        { windowsHide: true, timeout: 120000 }
      );

      console.log(new Date().toISOString(), 'printed', count, 'copy/copies on', printerName);
      res.json({ ok: true, printer: printerName, copies: count });
    } catch (error) {
      console.error(new Date().toISOString(), 'print failed:', error.message);
      res.status(500).json({ error: error.message || 'Print failed' });
    } finally {
      if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

app.listen(PORT, '127.0.0.1', () => console.log('Stationery print agent listening at http://127.0.0.1:' + PORT));
