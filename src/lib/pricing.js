// Price rules shared by the order form and the admin pages.
// The database applies the same rules when an order is saved (supabase/pricing-and-analytics.sql),
// so a customer cannot change what they are charged.

export const DEFAULT_PRICES = {
  print_bw: 100,      // printing, black & white, per page
  print_colour: 200,  // printing, colour, per page
  copy: 100,          // photocopying, per page
  form_page: 200,     // other university forms, per page
  binding: 500        // binding, per document
};

export const ORDER_TYPES = ['Printing', 'Photocopying', 'University form', 'Binding & finishing', 'Stationery purchase'];
export const PAGE_BASED_TYPES = ['Printing', 'Photocopying', 'University form'];

export const MAX_COPIES = 100;
export const MAX_PAGES = 2000;

export function formatTZS(amount) {
  return 'TZS ' + Math.round(Number(amount) || 0).toLocaleString('en-US');
}

export function clampInt(value, min, max, fallback) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

// Merge prices loaded from the database over the defaults, ignoring anything that is not a valid price.
export function mergePrices(rows) {
  const prices = { ...DEFAULT_PRICES };
  for (const row of rows || []) {
    if (row && row.key in prices && Number.isFinite(Number(row.price)) && Number(row.price) >= 0) {
      prices[row.key] = Number(row.price);
    }
  }
  return prices;
}

export function ratePerPage(orderType, colourMode, prices = DEFAULT_PRICES) {
  if (orderType === 'Printing') return colourMode === 'Colour' ? prices.print_colour : prices.print_bw;
  if (orderType === 'Photocopying') return prices.copy;
  if (orderType === 'University form') return prices.form_page;
  return 0;
}

// Works out the cost of a service order and explains it line by line.
// For "Binding & finishing", `copies` is the number of documents to bind.
export function priceOrder({ orderType, pages, copies, colourMode, addBinding }, prices = DEFAULT_PRICES) {
  const rates = { ...DEFAULT_PRICES, ...prices };
  const pageCount = clampInt(pages, 0, MAX_PAGES, 0);
  const copyCount = clampInt(copies, 1, MAX_COPIES, 1);
  const lines = [];

  if (orderType === 'Binding & finishing') {
    lines.push({
      label: `Binding: ${copyCount} ${copyCount === 1 ? 'document' : 'documents'} × ${formatTZS(rates.binding)}`,
      amount: copyCount * rates.binding
    });
  } else if (PAGE_BASED_TYPES.includes(orderType)) {
    if (pageCount < 1) return { ready: false, lines: [], total: 0 };
    const rate = ratePerPage(orderType, colourMode, rates);
    const what = orderType === 'Printing'
      ? (colourMode === 'Colour' ? 'Colour printing' : 'Black & white printing')
      : orderType === 'Photocopying' ? 'Photocopying' : 'University form';
    lines.push({
      label: `${what}: ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} × ${copyCount} ${copyCount === 1 ? 'copy' : 'copies'} × ${formatTZS(rate)}`,
      amount: pageCount * copyCount * rate
    });
    if (addBinding) {
      lines.push({
        label: `Binding: ${copyCount} ${copyCount === 1 ? 'document' : 'documents'} × ${formatTZS(rates.binding)}`,
        amount: copyCount * rates.binding
      });
    }
  } else {
    return { ready: false, lines: [], total: 0 };
  }

  return { ready: true, lines, total: lines.reduce((sum, line) => sum + line.amount, 0) };
}
