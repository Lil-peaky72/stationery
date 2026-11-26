// Sales reporting helpers. Every date is read in Dar es Salaam time (UTC+3, no daylight saving).

export const TZ = 'Africa/Dar_es_Salaam';
export const UTC_OFFSET = '+03:00';

// "Sales" are all orders except these. Pending and in-progress orders still count as booked sales.
export const EXCLUDED_STATUSES = ['Cancelled', 'Failed'];
export const isSale = (order) => !EXCLUDED_STATUSES.includes(order.status);

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

function parts(value) {
  const result = {};
  for (const part of partsFormatter.formatToParts(new Date(value))) result[part.type] = part.value;
  return result;
}

// "2026-11-26" for a timestamp, in Dar es Salaam time.
export function dateKey(value) {
  const { year, month, day } = parts(value);
  return `${year}-${month}-${day}`;
}

export function timeOfDay(value) {
  const { hour, minute } = parts(value);
  return `${hour}:${minute}`;
}

export const todayKey = () => dateKey(new Date());

export function addDays(key, days) {
  const date = new Date(key + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((new Date(to + 'T12:00:00Z') - new Date(from + 'T12:00:00Z')) / 86400000);
}

// Start (inclusive) and end (exclusive) of a date range, as timestamps the database understands.
export function rangeBounds(from, to) {
  return { start: `${from}T00:00:00${UTC_OFFSET}`, end: `${addDays(to, 1)}T00:00:00${UTC_OFFSET}` };
}

export const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month30', label: 'Last 30 days' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'thisYear', label: 'This year' }
];

export function presetRange(id, today = todayKey()) {
  const monthStart = today.slice(0, 8) + '01';
  switch (id) {
    case 'today': return { from: today, to: today };
    case 'week': return { from: addDays(today, -6), to: today };
    case 'month30': return { from: addDays(today, -29), to: today };
    case 'thisMonth': return { from: monthStart, to: today };
    case 'lastMonth': {
      const lastMonthEnd = addDays(monthStart, -1);
      return { from: lastMonthEnd.slice(0, 8) + '01', to: lastMonthEnd };
    }
    case 'thisYear': return { from: today.slice(0, 4) + '-01-01', to: today };
    default: return { from: today, to: today };
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dayLabel = (key) => `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
export const monthLabel = (key) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

function pagesOf(order) {
  const pages = Number(order.pages) || 0;
  return pages > 0 ? pages * (Number(order.copies) || 1) : 0;
}

// Turns a list of orders into the numbers shown on the analytics page and written to Excel.
export function summarize(orders, from, to) {
  const sales = orders.filter(isSale);
  const excluded = orders.filter((order) => !isSale(order));
  const revenue = sales.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

  const byService = new Map();
  const byStatus = new Map();
  for (const order of orders) {
    const status = byStatus.get(order.status) || { name: order.status, orders: 0, revenue: 0 };
    status.orders += 1;
    status.revenue += Number(order.total_amount || 0);
    byStatus.set(order.status, status);
  }
  for (const order of sales) {
    const service = byService.get(order.order_type) || { name: order.order_type, orders: 0, revenue: 0, pages: 0 };
    service.orders += 1;
    service.revenue += Number(order.total_amount || 0);
    service.pages += pagesOf(order);
    byService.set(order.order_type, service);
  }

  // One bar per day, or per month for long ranges.
  const span = daysBetween(from, to) + 1;
  const granularity = span > 92 ? 'month' : 'day';
  const buckets = new Map();
  if (granularity === 'day') {
    for (let i = 0; i < span; i += 1) {
      const key = addDays(from, i);
      buckets.set(key, { key, label: dayLabel(key), orders: 0, revenue: 0, excluded: 0 });
    }
  } else {
    for (let key = from.slice(0, 7) + '-01'; key <= to; key = addDays(key.slice(0, 8) + '28', 4).slice(0, 8) + '01') {
      buckets.set(key.slice(0, 7), { key: key.slice(0, 7), label: monthLabel(key), orders: 0, revenue: 0, excluded: 0 });
    }
  }
  for (const order of orders) {
    const day = dateKey(order.created_at);
    const bucket = buckets.get(granularity === 'day' ? day : day.slice(0, 7));
    if (!bucket) continue;
    if (isSale(order)) { bucket.orders += 1; bucket.revenue += Number(order.total_amount || 0); }
    else bucket.excluded += 1;
  }
  const series = [...buckets.values()];
  const best = series.reduce((top, bucket) => (bucket.revenue > (top?.revenue ?? 0) ? bucket : top), null);

  return {
    from, to, granularity, series, best,
    totalOrders: orders.length,
    salesOrders: sales.length,
    revenue,
    average: sales.length ? revenue / sales.length : 0,
    pages: sales.reduce((sum, order) => sum + pagesOf(order), 0),
    excludedOrders: excluded.length,
    excludedValue: excluded.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
    byService: [...byService.values()].sort((a, b) => b.revenue - a.revenue),
    byStatus: [...byStatus.values()].sort((a, b) => b.orders - a.orders)
  };
}

// Loads every order in a date range (the database returns at most 1,000 rows per request).
export async function fetchOrdersInRange(supabase, from, to) {
  const { start, end } = rangeBounds(from, to);
  const pageSize = 1000;
  const all = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}
