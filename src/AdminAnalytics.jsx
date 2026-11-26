import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { PRESETS, fetchOrdersInRange, presetRange, summarize, todayKey } from './lib/analytics.js';
import { downloadSalesWorkbook } from './lib/exportExcel.js';
import { formatTZS } from './lib/pricing.js';

const MAX_RANGE_DAYS = 800;

function shortMoney(value) {
  if (value >= 1000000) return (value / 1000000).toFixed(value >= 10000000 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (value >= 1000) return (value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(Math.round(value));
}

// A simple bar chart drawn with SVG: one bar per day (or month for long periods).
function SalesChart({ series, granularity }) {
  const width = 760;
  const height = 240;
  const pad = { top: 14, right: 12, bottom: 30, left: 46 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...series.map((bucket) => bucket.revenue), 0);
  const niceMax = max === 0 ? 1000 : Math.ceil(max / 1000) * 1000;
  const step = innerW / Math.max(series.length, 1);
  const barW = Math.max(2, Math.min(34, step * 0.7));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.max(1, Math.ceil(series.length / 8));

  return (
    <svg className="admin-chart" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Sales per ${granularity === 'day' ? 'day' : 'month'}, highest ${formatTZS(max)}`}>
      {ticks.map((tick) => {
        const y = pad.top + innerH - tick * innerH;
        return (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="chart-grid" />
            <text x={pad.left - 8} y={y + 3} textAnchor="end" className="chart-axis">{shortMoney(tick * niceMax)}</text>
          </g>
        );
      })}
      {series.map((bucket, index) => {
        const barH = (bucket.revenue / niceMax) * innerH;
        const x = pad.left + index * step + (step - barW) / 2;
        return (
          <g key={bucket.key}>
            <rect x={x} y={pad.top + innerH - barH} width={barW} height={Math.max(barH, bucket.revenue > 0 ? 1 : 0)} rx="2" className="chart-bar">
              <title>{`${bucket.label}: ${formatTZS(bucket.revenue)} from ${bucket.orders} ${bucket.orders === 1 ? 'order' : 'orders'}`}</title>
            </rect>
            {index % labelEvery === 0 && (
              <text x={x + barW / 2} y={height - 10} textAnchor="middle" className="chart-axis">{bucket.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function BreakdownBars({ rows, valueKey, format, emptyText }) {
  const max = Math.max(...rows.map((row) => row[valueKey]), 0);
  if (!rows.length) return <p className="admin-muted">{emptyText}</p>;
  return (
    <div className="admin-breakdown">
      {rows.map((row) => (
        <div className="admin-breakdown-row" key={row.name}>
          <div className="admin-breakdown-top"><span>{row.name}</span><b>{format(row)}</b></div>
          <div className="admin-breakdown-track"><div style={{ width: (max ? (row[valueKey] / max) * 100 : 0) + '%' }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalytics({ notify }) {
  const [preset, setPreset] = useState('month30');
  const [range, setRange] = useState(() => presetRange('month30'));
  const [orders, setOrders] = useState([]);
  const [loadedRange, setLoadedRange] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const rangeProblem = useMemo(() => {
    if (!range.from || !range.to) return 'Choose both dates.';
    if (range.from > range.to) return 'The start date must be before the end date.';
    const days = (new Date(range.to) - new Date(range.from)) / 86400000;
    if (days > MAX_RANGE_DAYS) return 'Please choose a period of about two years or less.';
    return '';
  }, [range]);

  const load = useCallback(async () => {
    if (rangeProblem) return;
    setLoading(true);
    setError('');
    try {
      const rows = await fetchOrdersInRange(supabase, range.from, range.to);
      setOrders(rows);
      setLoadedRange({ ...range });
    } catch (problem) {
      setError('Could not load sales: ' + (problem.message || 'unknown error'));
    } finally {
      setLoading(false);
    }
  }, [range, rangeProblem]);

  useEffect(() => { load(); }, [load]);

  function choosePreset(id) {
    setPreset(id);
    setRange(presetRange(id));
  }

  function changeDate(key, value) {
    setPreset('custom');
    setRange((current) => ({ ...current, [key]: value }));
  }

  const summary = useMemo(
    () => (loadedRange ? summarize(orders, loadedRange.from, loadedRange.to) : null),
    [orders, loadedRange]
  );

  async function exportExcel() {
    if (!loadedRange) return;
    setExporting(true);
    try {
      await downloadSalesWorkbook(orders, loadedRange);
    } catch (problem) {
      notify('Could not create the Excel file: ' + (problem.message || 'unknown error'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <section className="admin-panel">
        <div className="admin-panel-title">
          <div>
            <h2>Sales analytics</h2>
            <p>Choose a period to see sales, or download the same data as an Excel workbook for deeper analysis.</p>
          </div>
          <button className="admin-primary" onClick={exportExcel} disabled={loading || exporting || !loadedRange || Boolean(rangeProblem)}>
            {exporting ? 'Preparing Excel…' : 'Download Excel (.xlsx)'}
          </button>
        </div>

        <div className="admin-range">
          <div className="admin-chips" role="group" aria-label="Quick periods">
            {PRESETS.map((item) => (
              <button key={item.id} type="button" className={'admin-chip' + (preset === item.id ? ' active' : '')} onClick={() => choosePreset(item.id)}>{item.label}</button>
            ))}
          </div>
          <div className="admin-dates">
            <label>From<input type="date" value={range.from} max={todayKey()} onChange={(e) => changeDate('from', e.target.value)} /></label>
            <label>To<input type="date" value={range.to} max={todayKey()} onChange={(e) => changeDate('to', e.target.value)} /></label>
          </div>
        </div>
        {rangeProblem && <p className="admin-error" role="alert">{rangeProblem}</p>}
        {error && <p className="admin-error" role="alert">{error}</p>}
      </section>

      {loading && !summary && <p className="admin-muted">Loading sales…</p>}

      {summary && (
        <div className={loading ? 'admin-loading' : undefined}>
          <div className="admin-kpis">
            <div><small>Sales</small><strong>{formatTZS(summary.revenue)}</strong></div>
            <div><small>Orders</small><strong>{summary.salesOrders}</strong></div>
            <div><small>Average order</small><strong>{formatTZS(summary.average)}</strong></div>
            <div><small>Pages printed or copied</small><strong>{summary.pages.toLocaleString('en-US')}</strong></div>
            <div><small>Best {summary.granularity === 'day' ? 'day' : 'month'}</small><strong>{summary.best ? summary.best.label : '—'}</strong>{summary.best && <em>{formatTZS(summary.best.revenue)}</em>}</div>
          </div>

          <section className="admin-panel">
            <div className="admin-panel-title">
              <div><h2>Sales {summary.granularity === 'day' ? 'per day' : 'per month'}</h2><p>{summary.from} to {summary.to}</p></div>
            </div>
            {summary.salesOrders === 0
              ? <p className="admin-empty-note">No sales in this period.</p>
              : <SalesChart series={summary.series} granularity={summary.granularity} />}
          </section>

          <div className="admin-two-col">
            <section className="admin-panel">
              <div className="admin-panel-title"><div><h2>Sales by service</h2><p>Orders that count as sales</p></div></div>
              <BreakdownBars rows={summary.byService} valueKey="revenue" format={(row) => `${formatTZS(row.revenue)} · ${row.orders} ${row.orders === 1 ? 'order' : 'orders'}`} emptyText="No sales in this period." />
            </section>
            <section className="admin-panel">
              <div className="admin-panel-title"><div><h2>Orders by status</h2><p>All orders in the period</p></div></div>
              <BreakdownBars rows={summary.byStatus} valueKey="orders" format={(row) => `${row.orders} ${row.orders === 1 ? 'order' : 'orders'}`} emptyText="No orders in this period." />
            </section>
          </div>

          <p className="admin-help">
            Sales count every order except Cancelled and Failed, including orders that are still pending.
            {summary.excludedOrders > 0 && ` ${summary.excludedOrders} cancelled or failed ${summary.excludedOrders === 1 ? 'order' : 'orders'} (${formatTZS(summary.excludedValue)}) ${summary.excludedOrders === 1 ? 'is' : 'are'} left out.`}
            {' '}Dates use Dar es Salaam time.
          </p>
        </div>
      )}
    </>
  );
}
