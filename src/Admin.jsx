import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase.js';
import './admin.css';

const AGENT_URL = 'http://127.0.0.1:4317';
const STATUSES = ['Pending', 'Printing', 'Printed', 'Failed', 'Ready for collection', 'Completed', 'Cancelled'];
const PRINTABLE_STATUSES = ['Pending', 'Failed', 'Printed'];
const TOKEN_KEY = 'stationery_print_token';

const formatDate = (value) => new Date(value).toLocaleString('en-GB', {
  timeZone: 'Africa/Dar_es_Salaam', dateStyle: 'medium', timeStyle: 'short'
});

const money = (amount) => new Intl.NumberFormat('en-TZ', {
  style: 'currency', currency: 'TZS', maximumFractionDigits: 0
}).format(amount || 0);

function itemsSummary(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items.map((item) => item.quantity + ' × ' + item.name).join(', ');
}

async function agentRequest(path, token, { method = 'GET', body, timeout = 15000 } = {}) {
  const response = await fetch(AGENT_URL + path, {
    method,
    headers: { 'x-stationery-token': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Print agent error (' + response.status + ')');
  return data;
}

export default function Admin() {
  const [session, setSession] = useState(undefined); // undefined while loading, null when signed out
  const [isAdmin, setIsAdmin] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState('Pending');
  const [query, setQuery] = useState('');

  const [agentToken, setAgentToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [agentConnected, setAgentConnected] = useState(false);
  const [printerList, setPrinterList] = useState([]);
  const [printer, setPrinter] = useState('');
  const [connection, setConnection] = useState('USB');

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const notify = useCallback((text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 5000);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, []);

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(250);
    if (error) notify('Could not load orders: ' + error.message);
    else setOrders(data || []);
  }, [notify]);

  // Only accounts on the admin allowlist get past this point.
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) { setIsAdmin(null); setOrders([]); return undefined; }
    let cancelled = false;
    supabase.rpc('is_stationery_admin').then(({ data, error }) => {
      if (cancelled) return;
      if (error) notify('Could not check admin access: ' + error.message);
      setIsAdmin(!error && data === true);
      if (!error && data === true) loadOrders();
    });
    return () => { cancelled = true; };
  }, [userId, loadOrders, notify]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      const statusMatch = filter === 'All' || order.status === filter;
      const textMatch = !needle || [order.reference, order.customer_name, order.phone, order.registration_number, order.file_name]
        .some((value) => (value || '').toLowerCase().includes(needle));
      return statusMatch && textMatch;
    });
  }, [orders, filter, query]);

  const pending = orders.filter((order) => order.status === 'Pending' && order.file_path);
  const printerOptions = printerList.filter((item) => {
    const isUsb = /^USB/i.test(item.port || '');
    return connection === 'USB' ? isUsb : !isUsb;
  });

  async function signIn(event) {
    event.preventDefault();
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSigningIn(false);
    if (error) notify('Sign in failed. Check your email and password.');
    else setPassword('');
  }

  async function signOut() {
    await supabase.auth.signOut();
    setOrders([]);
    setSelected([]);
  }

  async function connectAgent() {
    try {
      await agentRequest('/health', agentToken);
      const list = await agentRequest('/printers', agentToken);
      setPrinterList(list.printers || []);
      setAgentConnected(true);
      localStorage.setItem(TOKEN_KEY, agentToken);
    } catch (error) {
      setAgentConnected(false);
      notify(error.message + ' Check that the Windows print agent is running and the token matches.');
    }
  }

  function switchConnection(value) {
    setConnection(value);
    setPrinter('');
  }

  function patchOrder(id, changes) {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, ...changes } : order));
  }

  async function setStatus(id, status) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) { notify('Status update failed: ' + error.message); return false; }
    patchOrder(id, { status });
    return true;
  }

  async function viewPdf(order) {
    // Open the tab first so the browser does not block it as a popup.
    const tab = window.open('', '_blank');
    const { data, error } = await supabase.storage.from('print-jobs').createSignedUrl(order.file_path, 120);
    if (error || !data?.signedUrl) {
      if (tab) tab.close();
      notify('Could not open the PDF: ' + (error?.message || 'unknown error'));
      return;
    }
    if (tab) tab.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  async function printOrder(order) {
    if (!order.file_path) { notify(order.reference + ' has no uploaded PDF.'); return false; }
    if (!printer || !agentToken) { notify('Connect the print agent and choose a printer first.'); return false; }

    const { data: signed, error: signError } = await supabase.storage.from('print-jobs').createSignedUrl(order.file_path, 300);
    if (signError || !signed?.signedUrl) {
      notify('Could not securely access the PDF: ' + (signError?.message || 'unknown error'));
      return false;
    }

    // Claim the job first so two open admin tabs cannot print the same order twice.
    const { data: claimed, error: claimError } = await supabase
      .from('orders')
      .update({ status: 'Printing' })
      .eq('id', order.id)
      .in('status', PRINTABLE_STATUSES)
      .select('id');
    if (claimError) { notify('Could not start the job: ' + claimError.message); return false; }
    if (!claimed?.length) { notify(order.reference + ' was changed elsewhere. Refresh the queue and try again.'); return false; }
    patchOrder(order.id, { status: 'Printing' });

    try {
      await agentRequest('/print', agentToken, {
        method: 'POST',
        timeout: 150000,
        body: {
          url: signed.signedUrl,
          printerName: printer,
          copies: Number(order.copies) || 1,
          paper: order.paper_size || 'A4',
          color: order.colour_mode || 'Black & white'
        }
      });
      await setStatus(order.id, 'Printed');
      return true;
    } catch (error) {
      await setStatus(order.id, 'Failed');
      notify('Printing ' + order.reference + ' failed: ' + error.message);
      return false;
    }
  }

  async function printOne(order) {
    setBusy(true);
    await printOrder(order);
    setBusy(false);
  }

  async function printBatch() {
    const batch = selected.length
      ? orders.filter((order) => selected.includes(order.id) && order.status === 'Pending' && order.file_path)
      : pending;
    if (!batch.length) { notify('No pending PDF jobs to print.'); return; }
    if (!printer) { notify('Choose a printer first.'); return; }
    if (!window.confirm('Send ' + batch.length + ' PDF job(s) to ' + printer + '?')) return;

    setBusy(true);
    let printed = 0;
    for (const order of batch) {
      if (await printOrder(order)) printed += 1;
    }
    setBusy(false);
    setSelected([]);
    await loadOrders();
    notify('Batch finished: ' + printed + ' of ' + batch.length + ' job(s) printed.');
  }

  if (session === undefined) {
    return <main className="admin-login"><p className="admin-muted">Loading…</p></main>;
  }

  if (!session) {
    return (
      <main className="admin-login">
        <form onSubmit={signIn}>
          <div className="admin-mark"><img src="https://journals.udom.ac.tz/public/site/logo_udom.png" alt="University of Dodoma official logo" /></div>
          <p className="admin-kicker">STATIONERY / SECURE AREA</p>
          <h1>Admin sign in</h1>
          <p>Sign in with the administrator account created in Supabase.</p>
          <label>Email<input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Password<input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className="admin-primary" disabled={signingIn}>{signingIn ? 'Signing in…' : 'Sign in'}</button>
          <a href="/">Back to shop</a>
        </form>
        {message && <div className="admin-toast">{message}</div>}
      </main>
    );
  }

  if (isAdmin === null) {
    return <main className="admin-login"><p className="admin-muted">Checking access…</p></main>;
  }

  if (!isAdmin) {
    return (
      <main className="admin-login">
        <form onSubmit={(e) => { e.preventDefault(); signOut(); }}>
          <div className="admin-mark"><img src="https://journals.udom.ac.tz/public/site/logo_udom.png" alt="University of Dodoma official logo" /></div>
          <h1>No access</h1>
          <p>{session.user.email} is not set up as a Stationery administrator.</p>
          <button className="admin-primary">Sign out</button>
          <a href="/">Back to shop</a>
        </form>
        {message && <div className="admin-toast">{message}</div>}
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-top">
        <a href="/" className="admin-brand"><img src="https://journals.udom.ac.tz/public/site/logo_udom.png" alt="University of Dodoma official logo" /><span>Stationery Admin</span></a>
        <div>
          <span className="admin-user">{session.user.email}</span>
          <button className="admin-quiet" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section className="admin-wrap">
        <div className="admin-heading">
          <div>
            <p className="admin-kicker">SHOP OPERATIONS</p>
            <h1>Orders and printing</h1>
            <p>Review every order, update its status, and send student PDFs to a printer connected to this Windows computer.</p>
          </div>
          <button className="admin-quiet" onClick={loadOrders}>Refresh queue ↻</button>
        </div>

        <div className="admin-stats">
          <div><small>Pending PDF jobs</small><strong>{pending.length}</strong></div>
          <div><small>All orders</small><strong>{orders.length}</strong></div>
          <div><small>Printed</small><strong>{orders.filter((order) => order.status === 'Printed').length}</strong></div>
          <div><small>Failed</small><strong>{orders.filter((order) => order.status === 'Failed').length}</strong></div>
        </div>

        <section className="admin-panel">
          <div className="admin-panel-title">
            <div>
              <h2>Printer connection</h2>
              <p>USB and Wi-Fi/network printers installed in Windows appear here.</p>
            </div>
            <span className={agentConnected ? 'admin-online' : 'admin-offline'}>{agentConnected ? 'Connected · Windows' : 'Not connected'}</span>
          </div>
          <div className="admin-printer-grid">
            <label>Connection type
              <select value={connection} onChange={(e) => switchConnection(e.target.value)}>
                <option>USB</option>
                <option>Wi-Fi / Network</option>
              </select>
            </label>
            <label>Windows printer
              <select value={printer} onChange={(e) => setPrinter(e.target.value)}>
                <option value="">Choose printer</option>
                {printerOptions.map((item) => <option key={item.name} value={item.name}>{item.name} · {item.port}</option>)}
              </select>
            </label>
          </div>
          <div className="admin-agent-row">
            <label>Local agent pairing token
              <input type="password" value={agentToken} onChange={(e) => setAgentToken(e.target.value)} placeholder="Paste token from Windows agent setup" />
            </label>
            <button className="admin-primary" onClick={connectAgent}>Connect & find printers</button>
          </div>
          <p className="admin-help">Copies, paper size and colour come from each order. Windows manages USB and network printers through its installed printer queue.</p>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-title">
            <div>
              <h2>Order queue</h2>
              <p>Change any order's status here. Only orders with an uploaded PDF can be printed.</p>
            </div>
            <div className="admin-actions">
              <input className="admin-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reference, name, phone…" aria-label="Search orders" />
              <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
                {[...STATUSES, 'All'].map((status) => <option key={status}>{status}</option>)}
              </select>
              <button className="admin-primary" disabled={busy || !agentConnected || !printer} onClick={printBatch}>
                {busy ? 'Printing…' : selected.length ? 'Print selected (' + selected.length + ')' : 'Print all pending (' + pending.length + ')'}
              </button>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th></th><th>Order</th><th>Customer</th><th>What they asked for</th><th>Document</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {visible.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={'Select ' + order.reference}
                        checked={selected.includes(order.id)}
                        disabled={order.status !== 'Pending' || !order.file_path}
                        onChange={(e) => setSelected((current) => e.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))}
                      />
                    </td>
                    <td><b>{order.reference}</b><small>{order.order_type}</small><small>{formatDate(order.created_at)}</small></td>
                    <td>
                      {order.customer_name}
                      <small><a href={'tel:' + order.phone}>{order.phone}</a></small>
                      {order.registration_number && <small>{order.registration_number}</small>}
                    </td>
                    <td className="admin-details">
                      {order.file_path && <small>{order.copies} × {order.paper_size} · {order.colour_mode}</small>}
                      {itemsSummary(order.items) && <small>{itemsSummary(order.items)}</small>}
                      {order.total_amount > 0 && <small>Total {money(order.total_amount)}</small>}
                      {order.details && <small className="admin-note">{order.details}</small>}
                      {!order.file_path && !itemsSummary(order.items) && !order.details && <span className="admin-muted">—</span>}
                    </td>
                    <td>
                      {order.file_path
                        ? <>{order.file_name || 'document.pdf'}<button className="admin-link" onClick={() => viewPdf(order)}>View PDF</button></>
                        : <span className="admin-muted">No PDF attached</span>}
                    </td>
                    <td>
                      <select
                        className={'admin-status-select ' + String(order.status).toLowerCase().replace(/\s+/g, '-')}
                        value={order.status}
                        disabled={busy}
                        onChange={(e) => setStatus(order.id, e.target.value)}
                        aria-label={'Status for ' + order.reference}
                      >
                        {STATUSES.map((status) => <option key={status}>{status}</option>)}
                      </select>
                    </td>
                    <td>
                      {order.file_path && PRINTABLE_STATUSES.includes(order.status)
                        ? <button className="admin-link" disabled={busy || !agentConnected || !printer} onClick={() => printOne(order)}>
                            {order.status === 'Printed' ? 'Reprint' : order.status === 'Failed' ? 'Retry' : 'Print'}
                          </button>
                        : <span className="admin-muted">—</span>}
                    </td>
                  </tr>
                ))}
                {!visible.length && <tr><td colSpan="7" className="admin-empty">No orders in this view.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="admin-help">Print all sends pending PDF orders one at a time. Failed jobs can be retried, and a job is claimed before printing so it cannot be sent twice.</p>
        </section>
      </section>
      {message && <div className="admin-toast">{message}</div>}
    </main>
  );
}
