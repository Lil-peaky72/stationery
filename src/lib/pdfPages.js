// Counts the pages of a PDF in the browser. Returns null when the file cannot be read,
// so the form can ask the customer to type the page count instead.
export async function countPdfPages(file) {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const bytes = await file.arrayBuffer();
    const document = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    const count = document.getPageCount();
    return count > 0 ? count : null;
  } catch {
    return null;
  }
}
