// Documents a customer can attach to an order: PDF or Word.

export const DOCUMENT_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};
export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,' + Object.values(DOCUMENT_TYPES).join(',');
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export function documentExtension(name) {
  const match = /\.([A-Za-z0-9]+)$/.exec(String(name || ''));
  return match ? match[1].toLowerCase() : '';
}

export const isAllowedDocument = (file) => Boolean(file && DOCUMENT_TYPES[documentExtension(file.name)]);
export const isPdfPath = (path) => /\.pdf$/i.test(String(path || ''));
export const isWordPath = (path) => /\.docx?$/i.test(String(path || ''));

// "STN-ABC123DEF0/my_notes.docx": the order reference, then a safe copy of the file name.
export function storagePathFor(reference, fileName) {
  const extension = documentExtension(fileName);
  const baseName = String(fileName).replace(/\.[A-Za-z0-9]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'document';
  return `${reference}/${baseName}.${extension}`;
}

async function countPdfPages(file) {
  const { PDFDocument } = await import('pdf-lib');
  const document = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
  return document.getPageCount();
}

// A .docx file is a zip. Word records the page count of the last save in docProps/app.xml.
async function countDocxPages(file) {
  const { unzipSync, strFromU8 } = await import('fflate');
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    // Read only the small properties file, and never anything unreasonably large.
    filter: (entry) => entry.name === 'docProps/app.xml' && entry.originalSize < 1024 * 1024
  });
  const xml = files['docProps/app.xml'] ? strFromU8(files['docProps/app.xml']) : '';
  const match = /<Pages>\s*(\d+)\s*<\/Pages>/i.exec(xml);
  return match ? Number(match[1]) : 0;
}

// Returns { pages, kind }. `pages` is null when the file cannot be read, so the form asks the customer to type it.
// For Word files the number is what Word saved, so the customer is asked to check it.
export async function countDocumentPages(file) {
  const kind = documentExtension(file?.name);
  try {
    let pages = 0;
    if (kind === 'pdf') pages = await countPdfPages(file);
    else if (kind === 'docx') pages = await countDocxPages(file);
    return { pages: pages > 0 ? pages : null, kind };
  } catch {
    return { pages: null, kind };
  }
}
