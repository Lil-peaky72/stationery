import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase.js';
import './admin.css';

const STATUSES = ['Pending', 'Received', 'Printing', 'Ready for collection', 'Completed', 'Cancelled'];
const CLOSED_STATUSES = ['Completed', 'Cancelled'];

const money = (amount) => new Intl.NumberFormat('en-TZ', {
  style: 'currency', currency: 'TZS', maximumFractionDigits: 0
}).format(amount || 0);

const formatDate = (value) => new Date(value).toLocaleString('en-GB', {
  timeZone: 'Africa/Dar_es_Salaam', dateStyle: 'medium', timeStyle: 'short'
});

function itemsSummary(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  return items.map((item) => `${item.quantity} × ${item.name}`).join(', ');
}

export default function AdminPanel() {
  const [session, setSession] = useState(undefined); // undefined while loading, null when signed out
  const [isAdmin, setIsAdmin] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [filter, setFilter] = useState('Open');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id, reference, customer_name, registration_number, phone, order_type, details, items, total_amount, status, created_at, document_path')
      .order('created_at', { ascending: false });
    setLoadingOrders(false);
    if (error) {
      setMessage('Could not load orders. ' + error.message);
      return;
    }
    setOrders(data || []);
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) {
      setIsAdmin(null);
      setOrders([]);
      return;
    }
    let cancelled = false;
    supabase.rpc('is_stationery_admin').then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setMessage('Could not check admin access. ' + error.message);
        setIsAdmin(false);
        return;
      }
      setIsAdmin(Boolean(data));
      if (data) loadOrders();
    });
    return () => { cancelled = true; };
  }, [userId, loadOrders]);

  async function signIn(event) {
    event.preventDefault();
    setMessage('');
    setSigningIn(true);
    const fields = new FormData(event.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fields.get('email') || '').trim(),
      password: String(fields.get('password') || '')
    });
    setSigningIn(false);
    if (error) setMessage('Sign in failed. Check your email and password.');
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMessage('');
  }

  async function changeStatus(order, status) {
    setMessage('');
    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id);
    if (error) {
      setMessage('Could not update the status. ' + error.message);
      return;
    }
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
  }

  async function openDocument(order) {
    setMessage('');
    // Open the tab first so the browser does not block it as a popup.
    const tab = window.open('', '_blank');
    const { data, error } = await supabase.storage.from('order-documents').createSignedUrl(order.document_path, 120);
    if (error || !data?.signedUrl) {
      if (tab) tab.close();
      setMessage('Could not open the document. ' + (error?.message || ''));
      return;
    }
    if (tab) tab.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  }

  const visibleOrders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      const statusMatch = filter === 'All'
        || (filter === 'Open' ? !CLOSED_STATUSES.includes(order.status) : order.status === filter);
      const textMatch = !needle || [order.reference, order.customer_name, order.phone, order.registration_number]
        .some((value) => (value || '').toLowerCase().includes(needle));
      return statusMatch && textMatch;
    });
  }, [orders, filter, query]);

  if (session === undefined) {
    return <main className="admin-shell"><p className="admin-muted">Loading…</p></main>;
  }

  if (!session) {
    return (
      <main className="admin-shell">
        <form className="admin-card admin-login" onSubmit={signIn}>
          <span className="eyebrow">STATIONERY / STAFF</span>
          <h1>Admin sign in</h1>
          <label>Email<input name="email" type="email" required autoComplete="username" /></label>
          <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
          {message && <p className="admin-error" role="alert">{message}</p>}
          <button className="button button-primary" type="submit" disabled={signingIn}>{signingIn ? 'Signing in…' : 'Sign in'}</button>
          <a className="admin-back" href="#">Back to the shop</a>
        </form>
      </main>
    );
  }

  if (isAdmin === null) {
    return <main className="admin-shell"><p className="admin-muted">Checking access…</p></main>;
  }

  if (!isAdmin) {
    return (
      <main className="admin-shell">
        <div className="admin-card admin-login">
          <h1>No access</h1>
          <p className="admin-muted">{session.user.email} is not set up as a Stationery admin.</p>
          {message && <p className="admin-error" role="alert">{message}</p>}
          <button className="button button-light" onClick={signOut}>Sign out</button>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <span className="eyebrow">STATIONERY / STAFF</span>
          <h1>Orders</h1>
        </div>
        <div className="admin-header-actions">
          <span className="admin-muted">{session.user.email}</span>
          <button className="button button-light" onClick={loadOrders} disabled={loadingOrders}>{loadingOrders ? 'Refreshing…' : 'Refresh'}</button>
          <button className="button button-light" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="admin-toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
          <option>Open</option>
          <option>All</option>
          {STATUSES.map((status) => <option key={status}>{status}</option>)}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reference, name, phone…" aria-label="Search orders" />
        <span className="admin-muted">{visibleOrders.length} of {orders.length}</span>
      </div>

      {message && <p className="admin-error" role="alert">{message}</p>}

      <section className="admin-list">
        {visibleOrders.length === 0 && !loadingOrders && <p className="admin-muted">No orders to show.</p>}
        {visibleOrders.map((order) => (
          <article className="admin-card admin-order" key={order.id}>
            <div className="admin-order-top">
              <div>
                <strong>{order.reference}</strong>
                <small>{formatDate(order.created_at)}</small>
              </div>
              <select value={order.status} onChange={(e) => changeStatus(order, e.target.value)} aria-label={'Status for ' + order.reference}>
                {STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
            <p className="admin-order-meta">
              <b>{order.customer_name}</b>
              {' · '}<a href={'tel:' + order.phone}>{order.phone}</a>
              {order.registration_number ? ' · ' + order.registration_number : ''}
            </p>
            <p className="admin-order-meta"><b>{order.order_type}</b>{order.total_amount > 0 ? ' · ' + money(order.total_amount) : ''}</p>
            {itemsSummary(order.items) && <p className="admin-order-details">{itemsSummary(order.items)}</p>}
            {order.details && <p className="admin-order-details">{order.details}</p>}
            {order.document_path && <button className="button button-light admin-doc" onClick={() => openDocument(order)}>Open document</button>}
          </article>
        ))}
      </section>
    </main>
  );
}
