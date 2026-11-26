import { dateKey, isSale, summarize, timeOfDay } from './analytics.js';

const NAVY = 'FF102B56';
const TEAL = 'FF23827E';
const TZS_FORMAT = '#,##0';

// Excel has no time zones, so dates are written as the Dar es Salaam calendar date.
const excelDate = (key) => new Date(key + 'T00:00:00Z');

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  row.alignment = { vertical: 'middle', wrapText: true };
  row.height = 22;
}

// Builds the report workbook. `ExcelJS` is passed in so the same code runs in the browser and in tests.
export function buildSalesWorkbook(ExcelJS, orders, { from, to }) {
  const summary = summarize(orders, from, to);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Stationery';
  workbook.created = new Date();

  // --- Summary -------------------------------------------------------------------
  const sheet = workbook.addWorksheet('Summary', { views: [{ showGridLines: false }] });
  sheet.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }];
  sheet.mergeCells('A1:D1');
  sheet.getCell('A1').value = 'Stationery sales report';
  sheet.getCell('A1').font = { size: 18, bold: true, color: { argb: NAVY } };
  sheet.getCell('A2').value = `Period: ${from} to ${to} (Dar es Salaam time)`;
  sheet.getCell('A3').value = 'Sales = every order except Cancelled and Failed, including orders still pending.';
  sheet.getCell('A3').font = { italic: true, color: { argb: 'FF718096' } };

  const kpis = [
    ['Sales (TZS)', summary.revenue, TZS_FORMAT],
    ['Orders counted as sales', summary.salesOrders, '0'],
    ['Average order (TZS)', Math.round(summary.average), TZS_FORMAT],
    ['Pages printed or copied', summary.pages, TZS_FORMAT],
    ['Best ' + (summary.granularity === 'day' ? 'day' : 'month'), summary.best ? `${summary.best.label} (TZS ${Math.round(summary.best.revenue).toLocaleString('en-US')})` : '-', '@'],
    ['Cancelled or failed orders', summary.excludedOrders, '0'],
    ['Value of cancelled or failed orders (TZS)', summary.excludedValue, TZS_FORMAT],
    ['All orders in period', summary.totalOrders, '0']
  ];
  let rowIndex = 5;
  for (const [label, value, format] of kpis) {
    const row = sheet.getRow(rowIndex++);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
    row.getCell(2).numFmt = format;
    row.getCell(2).alignment = { horizontal: 'left' };
  }

  rowIndex += 1;
  sheet.getRow(rowIndex).getCell(1).value = 'By service';
  sheet.getRow(rowIndex).getCell(1).font = { bold: true, size: 13, color: { argb: TEAL } };
  rowIndex += 1;
  ['Service', 'Orders', 'Sales (TZS)', 'Pages'].forEach((text, i) => { sheet.getRow(rowIndex).getCell(i + 1).value = text; });
  styleHeader(sheet.getRow(rowIndex));
  rowIndex += 1;
  for (const service of summary.byService) {
    const row = sheet.getRow(rowIndex++);
    row.values = [service.name, service.orders, service.revenue, service.pages];
    row.getCell(3).numFmt = TZS_FORMAT;
    row.getCell(4).numFmt = TZS_FORMAT;
  }

  rowIndex += 1;
  sheet.getRow(rowIndex).getCell(1).value = 'By status (all orders)';
  sheet.getRow(rowIndex).getCell(1).font = { bold: true, size: 13, color: { argb: TEAL } };
  rowIndex += 1;
  ['Status', 'Orders', 'Value (TZS)'].forEach((text, i) => { sheet.getRow(rowIndex).getCell(i + 1).value = text; });
  styleHeader(sheet.getRow(rowIndex));
  rowIndex += 1;
  for (const status of summary.byStatus) {
    const row = sheet.getRow(rowIndex++);
    row.values = [status.name, status.orders, status.revenue];
    row.getCell(3).numFmt = TZS_FORMAT;
  }

  // --- Orders (one row per order, ready for filters and pivot tables) ----------------
  const ordersSheet = workbook.addWorksheet('Orders', { views: [{ state: 'frozen', ySplit: 1 }] });
  const columns = [
    ['Order reference', 18], ['Date', 12], ['Time', 8], ['Month', 10], ['Weekday', 11],
    ['Customer', 24], ['Phone', 16], ['Registration number', 20],
    ['Service', 20], ['Status', 18], ['Counted as sale', 14],
    ['Pages', 8], ['Copies', 8], ['Paper', 9], ['Colour', 14], ['Binding added', 12],
    ['Total (TZS)', 14], ['Document', 28], ['Details', 50]
  ];
  ordersSheet.columns = columns.map(([header, width]) => ({ header, width }));
  styleHeader(ordersSheet.getRow(1));

  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  orders.forEach((order, index) => {
    const day = dateKey(order.created_at);
    const row = ordersSheet.getRow(index + 2);
    row.values = [
      order.reference,
      excelDate(day),
      timeOfDay(order.created_at),
      day.slice(0, 7),
      WEEKDAYS[excelDate(day).getUTCDay()],
      order.customer_name,
      order.phone,
      order.registration_number || '',
      order.order_type,
      order.status,
      isSale(order) ? 'Yes' : 'No',
      Number(order.pages) || null,
      Number(order.copies) || null,
      order.paper_size || '',
      order.colour_mode || '',
      order.add_binding ? 'Yes' : 'No',
      Number(order.total_amount || 0),
      order.file_name || '',
      order.details || ''
    ];
    row.getCell(2).numFmt = 'yyyy-mm-dd';
    row.getCell(17).numFmt = TZS_FORMAT;
    row.getCell(19).alignment = { wrapText: true, vertical: 'top' };
  });
  const lastRow = orders.length + 1;
  if (orders.length > 0) {
    ordersSheet.autoFilter = { from: 'A1', to: `S${lastRow}` };
    const totalRow = ordersSheet.getRow(lastRow + 2);
    totalRow.getCell(16).value = 'Total of rows shown';
    totalRow.getCell(16).font = { bold: true };
    totalRow.getCell(17).value = { formula: `SUBTOTAL(109,Q2:Q${lastRow})`, result: orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) };
    totalRow.getCell(17).numFmt = TZS_FORMAT;
    totalRow.getCell(17).font = { bold: true };
  }

  // --- Daily / monthly totals ---------------------------------------------------------
  const periodSheet = workbook.addWorksheet(summary.granularity === 'day' ? 'Daily' : 'Monthly', { views: [{ state: 'frozen', ySplit: 1 }] });
  periodSheet.columns = [
    { header: summary.granularity === 'day' ? 'Date' : 'Month', width: 14 },
    { header: 'Orders (sales)', width: 16 },
    { header: 'Sales (TZS)', width: 16 },
    { header: 'Cancelled or failed', width: 20 }
  ];
  styleHeader(periodSheet.getRow(1));
  summary.series.forEach((bucket, index) => {
    const row = periodSheet.getRow(index + 2);
    row.values = [
      summary.granularity === 'day' ? excelDate(bucket.key) : bucket.key,
      bucket.orders,
      bucket.revenue,
      bucket.excluded
    ];
    if (summary.granularity === 'day') row.getCell(1).numFmt = 'yyyy-mm-dd';
    row.getCell(3).numFmt = TZS_FORMAT;
  });

  return workbook;
}

export function reportFileName(from, to) {
  return from === to ? `stationery-sales_${from}.xlsx` : `stationery-sales_${from}_to_${to}.xlsx`;
}

// Builds the workbook and downloads it. Excel support is loaded only when the button is pressed.
export async function downloadSalesWorkbook(orders, range) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = buildSalesWorkbook(ExcelJS, orders, range);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = reportFileName(range.from, range.to);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

