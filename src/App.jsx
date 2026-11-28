import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase.js';
import DocumentStudio from './DocumentStudio.jsx';
import { DEFAULT_PRICES, MAX_COPIES, MAX_PAGES, PAGE_BASED_TYPES, clampInt, formatTZS, mergePrices, priceOrder } from './lib/pricing.js';
import { DOCUMENT_ACCEPT, DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, countDocumentPages, documentExtension, isAllowedDocument, storagePathFor } from './lib/documents.js';
import {
  ArrowRight, BookOpen, Check, ChevronDown, Clock3, FileText,
  Headphones, Menu, Minus, Plus, Printer, Search, ShieldCheck,
  ShoppingBag, ShoppingCart, Sparkles, UploadCloud, X, ClipboardList
} from 'lucide-react';

const products = [
  { id: 1, name: 'A4 Exercise Book', category: 'Books', price: 3500, detail: '96 pages · ruled', icon: '📓', tag: 'Student pick' },
  { id: 2, name: 'Blue Ballpoint Pens', category: 'Writing', price: 1500, detail: 'Pack of 5 · smooth ink', icon: '🖊️', tag: 'Everyday essential' },
  { id: 3, name: 'Document File', category: 'Organisation', price: 2500, detail: 'A4 · durable cover', icon: '📁', tag: 'Stay organised' },
  { id: 4, name: 'Sticky Notes', category: 'Organisation', price: 3000, detail: 'Assorted colours', icon: '🗒️', tag: 'Study smarter' },
  { id: 5, name: 'Scientific Calculator', category: 'Study tools', price: 18000, detail: 'Student calculator', icon: '🧮', tag: 'Study tool' },
  { id: 6, name: 'Highlighter Set', category: 'Writing', price: 4500, detail: 'Set of 4 colours', icon: '🖍️', tag: 'Colour code notes' }
];

const services = [
  { icon: Printer, title: 'Document printing', type: 'Printing', text: 'Clear black & white or colour prints for notes, reports and coursework.' },
  { icon: FileText, title: 'Photocopying', type: 'Photocopying', text: 'Sharp, reliable copies for class materials and important documents.' },
  { icon: ClipboardList, title: 'University forms', type: 'University form', text: 'Registration, clearance and other university forms printed neatly and ready to submit.' },
  { icon: BookOpen, title: 'Binding & finishing', type: 'Binding & finishing', text: 'Neat spiral, comb and premium finishes for assignments and projects.' }
];

function serviceRate(type, prices) {
  if (type === 'Printing') return `${formatTZS(prices.print_bw)} black & white · ${formatTZS(prices.print_colour)} colour, per page`;
  if (type === 'Photocopying') return `${formatTZS(prices.copy)} per page`;
  if (type === 'University form') return `${formatTZS(prices.form_page)} per page`;
  if (type === 'Binding & finishing') return `${formatTZS(prices.binding)} per document`;
  return '';
}

const PAPER_SIZES = ['A4', 'A3', 'Letter', 'Legal'];
const COLOUR_MODES = ['Black & white', 'Colour'];

const money = formatTZS;

export default function App() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [modal, setModal] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [orderType, setOrderType] = useState('Printing');
  const [customerType, setCustomerType] = useState('Individual');
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [pages, setPages] = useState('');
  const [pagesNote, setPagesNote] = useState('');
  const [countingPages, setCountingPages] = useState(false);
  const [copies, setCopies] = useState(1);
  const [colourMode, setColourMode] = useState('Black & white');
  const [paperSize, setPaperSize] = useState('A4');
  const [addBinding, setAddBinding] = useState(false);
  const [groupMemberCount, setGroupMemberCount] = useState(2);
  const [notice, setNotice] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [lastOrderReference, setLastOrderReference] = useState('');
  const [trackingReference, setTrackingReference] = useState('');
  const [trackingResult, setTrackingResult] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const categories = ['All', 'Books', 'Writing', 'Organisation', 'Study tools'];
  const visibleProducts = useMemo(() => products.filter((product) => {
    const categoryMatch = activeCategory === 'All' || product.category === activeCategory;
    const searchMatch = (product.name + product.detail).toLowerCase().includes(search.toLowerCase());
    return categoryMatch && searchMatch;
  }), [activeCategory, search]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  // Live prices come from the shop's price list; the built-in prices are used if it cannot be reached.
  useEffect(() => {
    let cancelled = false;
    supabase.from('price_list').select('key, price').then(({ data, error }) => {
      if (!cancelled && !error && data?.length) setPrices(mergePrices(data));
    });
    return () => { cancelled = true; };
  }, []);

  const quote = priceOrder({ orderType, pages, copies, colourMode, addBinding }, prices);

  async function onDocumentChange(event) {
    const file = event.target.files?.[0];
    if (!file) { setPagesNote(''); return; }
    setCountingPages(true);
    setPagesNote('Counting pages…');
    const { pages: count, kind } = await countDocumentPages(file);
    setCountingPages(false);
    if (count) {
      setPages(String(Math.min(count, MAX_PAGES)));
      const noun = count === 1 ? 'page' : 'pages';
      setPagesNote(count > MAX_PAGES
        ? `This document has ${count} pages. Please contact the shop for very large jobs.`
        : kind === 'docx'
          ? `Word says your document has ${count} ${noun}. Please check this is right. You can change it.`
          : `${count} ${noun} found in your PDF. You can change this if needed.`);
    } else if (kind === 'doc') {
      setPagesNote('Please type the number of pages. (Tip: saving your file as .docx or PDF lets us count them for you.)');
    } else {
      setPagesNote('We could not count the pages automatically. Please type the number of pages.');
    }
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function addToCart(product) {
    setCart((current) => {
      const found = current.find((item) => item.id === product.id);
      return found
        ? current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }];
    });
    setNotice(product.name + ' added to your bag');
    window.setTimeout(() => setNotice(''), 2400);
  }

  function changeQuantity(id, amount) {
    setCart((current) => current
      .map((item) => item.id === id ? { ...item, quantity: item.quantity + amount } : item)
      .filter((item) => item.quantity > 0));
  }

  function flash(message, duration = 4000) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), duration);
  }

  async function submitOrder(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);

    // Hidden field that real customers never see; simple bots tend to fill it in.
    if (fields.get('contact_fax_hp')) return;

    const documentFile = fields.get('document_file');
    const hasFile = orderType !== 'Stationery purchase' && documentFile instanceof File && documentFile.size > 0;

    if (orderType === 'Printing' && !hasFile) {
      flash('Please attach the document you want printed (PDF or Word).');
      return;
    }
    if (orderType !== 'Stationery purchase' && !quote.ready) {
      flash('Please enter the number of pages so we can work out your cost.');
      return;
    }
    if (hasFile) {
      if (!isAllowedDocument(documentFile)) { flash('Please attach a PDF or Word document (.pdf, .doc or .docx).'); return; }
      if (documentFile.size > MAX_DOCUMENT_BYTES) { flash('The document must be 20 MB or smaller.'); return; }
    }

    const groupMembers = customerType === 'Group' ? Array.from({ length: groupMemberCount }, (_, index) => ({
      full_name: String(fields.get(`member_name_${index}`) || '').trim(),
      registration_number: String(fields.get(`member_registration_${index}`) || '').trim(),
      phone: String(fields.get(`member_phone_${index}`) || '').trim()
    })) : [];
    const orderDetails = [
      String(fields.get('details') || '').trim(),
      customerType === 'Group'
        ? `GROUP ORDER (${groupMembers.length} MEMBERS)\n${groupMembers.map((m, i) => `${i + 1}. ${m.full_name} | ${m.registration_number} | ${m.phone}`).join('\n')}`
        : 'INDIVIDUAL ORDER'
    ].filter(Boolean).join('\n\n');

    setSavingOrder(true);
    const reference = 'STN-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();

    let filePath = null;
    if (hasFile) {
      filePath = storagePathFor(reference, documentFile.name);
      const { error: uploadError } = await supabase.storage
        .from('print-jobs')
        .upload(filePath, documentFile, { contentType: DOCUMENT_TYPES[documentExtension(documentFile.name)], upsert: false });
      if (uploadError) {
        console.error('Document upload failed', uploadError);
        setSavingOrder(false);
        flash('Could not upload your document. Please try again, or send it as a PDF.');
        return;
      }
    }

    const order = {
      reference,
      customer_name: String(fields.get('customer_name') || '').trim(),
      registration_number: String(fields.get('registration_number') || '').trim() || null,
      phone: String(fields.get('phone') || '').trim(),
      order_type: orderType,
      details: orderDetails || null,
      items: orderType === 'Stationery purchase' ? cart : [],
      total_amount: orderType === 'Stationery purchase' ? cartTotal : quote.total
    };

    if (orderType !== 'Stationery purchase') {
      order.copies = clampInt(copies, 1, MAX_COPIES, 1);
      if (PAGE_BASED_TYPES.includes(orderType)) {
        order.pages = clampInt(pages, 1, MAX_PAGES, 1);
        order.add_binding = addBinding;
      }
      if (orderType === 'Printing' || orderType === 'University form') order.paper_size = PAPER_SIZES.includes(paperSize) ? paperSize : 'A4';
      if (orderType === 'Printing') order.colour_mode = COLOUR_MODES.includes(colourMode) ? colourMode : 'Black & white';
    }
    if (hasFile) {
      order.file_path = filePath;
      order.file_name = documentFile.name.slice(0, 200);
      order.mime_type = DOCUMENT_TYPES[documentExtension(documentFile.name)];
    }

    let { error } = await supabase.from('orders').insert(order);
    if (error && ['42501', 'PGRST204', '42703'].includes(error.code) && order.copies !== undefined) {
      // The database has not been updated for print options or page counts yet
      // (supabase/printing-hardening.sql and supabase/pricing-and-analytics.sql).
      // Save the order without them rather than losing it.
      const { copies: _c, paper_size: _p, colour_mode: _m, pages: _g, add_binding: _b, ...basicOrder } = order;
      ({ error } = await supabase.from('orders').insert(basicOrder));
    }
    setSavingOrder(false);
    if (error) {
      console.error('Order could not be saved', error);
      flash('Could not save your order. Please try again. (' + (error.code || 'error') + ')', 7000);
      return;
    }
    setLastOrderReference(reference);
    setCart([]);
    setModal('submitted');
  }

  async function trackOrder(event) {
    event.preventDefault();
    setTrackingLoading(true);
    setTrackingResult(null);
    const { data, error } = await supabase.rpc('track_stationery_order', {
      order_reference: trackingReference.trim().toUpperCase()
    });
    setTrackingLoading(false);
    setTrackingResult(error || !data?.length
      ? { error: 'No order was found with that reference.' }
      : data[0]);
  }

  function openOrder(type) {
    setOrderType(type);
    setPages('');
    setPagesNote('');
    setCopies(1);
    setColourMode('Black & white');
    setPaperSize('A4');
    setAddBinding(false);
    setModal('order');
  }

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenu(false);
  }

  return (
    <div className="site-shell">
      <div className="announcement"><Sparkles size={14} /> Your campus essentials, made simple <span>·</span> Friendly student prices</div>
      <header className="header">
        <a className="brand" href="#home" onClick={(e) => { e.preventDefault(); scrollTo('home'); }}>
          <span className="brand-mark"><img src="https://journals.udom.ac.tz/public/site/logo_udom.png" alt="Official University of Dodoma logo" /></span>
          <span>stationery<span className="brand-dot">.</span><small>PRINT · BIND · SUPPLY</small></span>
        </a>
        <button className="mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">{mobileMenu ? <X /> : <Menu />}</button>
        <nav className={mobileMenu ? 'nav-links nav-open' : 'nav-links'}>
          <button onClick={() => scrollTo('home')}>Home</button>
          <button onClick={() => scrollTo('services')}>Printing services</button>
          <button onClick={() => scrollTo('document-studio')}>Document editor</button>
          <button onClick={() => scrollTo('shop')}>Stationery shop</button>
          <button onClick={() => setModal('track')}>Track order</button>
        </nav>
        <div className="header-actions">
          <button className="icon-button" aria-label="Search products" onClick={() => scrollTo('shop')}><Search size={19} /></button>
          <button className="cart-button" onClick={() => setModal('cart')}><ShoppingBag size={18} /><span>My bag</span><b>{cartCount}</b></button>
        </div>
      </header>

      <main>
        <section className="hero section-wrap" id="home">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> THE STUDENT'S PRINT & SUPPLY STORE</div>
            <h1>Big ideas deserve<br /><em>beautiful</em> prints.</h1>
            <p className="hero-description">From your first lecture notes to your final-year project, get printing, binding and everyday study essentials without the campus hassle.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={() => openOrder('Printing')}>Print a document <ArrowRight size={17} /></button>
              <button className="button button-light" onClick={() => scrollTo('shop')}>Explore stationery</button>
            </div>
            <div className="hero-proof"><span className="proof-icon"><Check size={14} /></span> Simple ordering <span className="proof-separator">·</span> Student-focused <span className="proof-separator">·</span> Quality finish</div>
          </div>
          <div className="hero-visual">
            <div className="visual-glow" />
            <div className="paper paper-back"><span>YOUR NEXT<br />BIG IDEA</span></div>
            <div className="paper paper-front">
              <div className="paper-top"><span className="mini-brand">S.</span><span>STUDENT EDITION / 01</span></div>
              <div className="paper-rule" />
              <div className="paper-heading">Make room<br />for great work.</div>
              <div className="paper-lines"><i /><i /><i /><i /></div>
              <div className="paper-footer"><span>PRINTED WITH CARE</span><span>2026</span></div>
            </div>
            <div className="floating-note note-one"><span>✳</span><div><b>Print it.</b><small>We'll handle the details.</small></div></div>
            <div className="floating-note note-two"><span className="note-check"><Check size={16} /></span><div><b>Ready for class</b><small>One less thing to worry about.</small></div></div>
            <div className="visual-caption">YOUR WORK, PRESENTED WELL.</div>
          </div>
        </section>

        <section className="trust-strip">
          <div><ShieldCheck size={19} /><span>Careful document handling</span></div>
          <div><Clock3 size={19} /><span>Convenient order tracking</span></div>
          <div><Headphones size={19} /><span>Friendly student support</span></div>
        </section>

        <DocumentStudio />

        <section className="section-wrap services-section" id="services">
          <div className="section-heading">
            <div><div className="eyebrow">WHAT WE CAN DO FOR YOU</div><h2>Print work. <em>Less worry.</em></h2></div>
            <p>All the essentials for your academic journey, brought together in one simple place.</p>
          </div>
          <div className="service-grid">
            {services.map(({ icon: Icon, title, type, text }, index) => (
              <article className="service-card" key={title}>
                <div className="service-icon">{<Icon size={23} />}</div>
                <span className="service-number">0{index + 1}</span>
                <h3>{title}</h3><p>{text}</p>
                <p className="service-rate">{serviceRate(type, prices)}</p>
                <button className="text-link" onClick={() => openOrder(type)}>Request service <ArrowRight size={15} /></button>
              </article>
            ))}
          </div>
        </section>

        <section className="shop-section" id="shop">
          <div className="section-wrap">
            <div className="section-heading shop-heading">
              <div><div className="eyebrow">THE LITTLE THINGS THAT HELP YOU GO FAR</div><h2>Stock up for <em>success.</em></h2></div>
              <p>Useful study supplies selected with students in mind.</p>
            </div>
            <div className="shop-toolbar">
              <div className="category-list">
                {categories.map((category) => <button key={category} className={activeCategory === category ? 'category active' : 'category'} onClick={() => setActiveCategory(category)}>{category}</button>)}
              </div>
              <label className="search-field"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find an item..." /></label>
            </div>
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <article className="product-card" key={product.id}>
                  <div className={'product-art art-' + product.id}><span className="product-emoji">{product.icon}</span><span className="product-tag">{product.tag}</span></div>
                  <div className="product-info"><div><h3>{product.name}</h3><p>{product.detail}</p></div><div className="product-buy"><b>{money(product.price)}</b><button aria-label={'Add ' + product.name + ' to bag'} onClick={() => addToCart(product)}><Plus size={18} /></button></div></div>
                </article>
              ))}
              {visibleProducts.length === 0 && <div className="empty-state">No items match your search. Try another name or category.</div>}
            </div>
            <p className="price-note">Sample catalogue and prices for the prototype. Final prices and availability will be configured by the shop administrator.</p>
          </div>
        </section>

        <section className="print-cta section-wrap">
          <div className="cta-icon"><UploadCloud size={29} /></div>
          <div><div className="eyebrow">HAVE A DOCUMENT READY?</div><h2>Your assignment. <em>Our next job.</em></h2><p>Prepare your PDF or Word document and start a print request.</p></div>
          <button className="button button-white" onClick={() => openOrder('Printing')}>Start a print order <ArrowRight size={17} /></button>
        </section>

        <section className="section-wrap how-section">
          <div className="section-heading"><div><div className="eyebrow">A SIMPLE WAY TO GET IT DONE</div><h2>Three steps. <em>That's it.</em></h2></div></div>
          <div className="steps-grid"><div><span>01</span><h3>Choose your service</h3><p>Select printing, binding or the supplies you need.</p></div><div><span>02</span><h3>Send your details</h3><p>Share your document or add products to your bag.</p></div><div><span>03</span><h3>Follow your order</h3><p>Keep your tracking reference handy and stay updated.</p></div></div>
        </section>
      </main>

      <footer className="footer">
        <div className="section-wrap footer-inner"><div className="brand footer-brand"><span className="brand-mark"><img src="https://journals.udom.ac.tz/public/site/logo_udom.png" alt="University of Dodoma official logo" /></span><span>stationery<span className="brand-dot">.</span><small>PRINT · BIND · SUPPLY</small></span></div><p>Helping students get their best work out into the world.</p><div className="footer-bottom"><span>© 2026 Stationery. Built for students.</span><button onClick={() => setModal('support')}>Need help? Contact support <ArrowRight size={14} /></button></div></div>
      </footer>

      {notice && <div className="toast"><Check size={16} />{notice}</div>}

      {modal && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(''); }}>
        <div className="modal-panel">
          <div className="modal-header"><div><span className="eyebrow">STATIONERY / STUDENT SERVICES</span><h2>{modal === 'cart' ? 'Your bag' : modal === 'track' ? 'Track an order' : modal === 'support' ? "We're here to help" : modal === 'order' ? 'Start an order' : 'Your request'}</h2></div><button className="close-modal" onClick={() => setModal('')} aria-label="Close"><X /></button></div>
          {modal === 'cart' && <div className="cart-content">{cart.length === 0 ? <div className="empty-cart"><ShoppingCart size={32} /><h3>Your bag is waiting</h3><p>Add stationery essentials from the shop to see them here.</p><button className="button button-primary" onClick={() => { setModal(''); scrollTo('shop'); }}>Browse the shop</button></div> : <><div className="cart-items">{cart.map((item) => <div className="cart-row" key={item.id}><span className="cart-emoji">{item.icon}</span><div className="cart-item-name"><b>{item.name}</b><small>{money(item.price)} each</small></div><div className="quantity"><button onClick={() => changeQuantity(item.id, -1)}><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)}><Plus size={13} /></button></div><b>{money(item.price * item.quantity)}</b></div>)}</div><div className="cart-total"><span>Estimated total</span><b>{money(cartTotal)}</b></div><p className="form-hint">Checkout and payment will be connected in a later development phase.</p><button className="button button-primary full-button" onClick={() => { setModal('order'); setOrderType('Stationery purchase'); }}>Continue with request <ArrowRight size={16} /></button></>}</div>}
          {modal === 'order' && <form className="order-form" onSubmit={submitOrder}>
            <p className="form-intro">Tell us what you need and attach your PDF or Word document. Your order and document will be sent securely to the shop.</p>
            <label>What do you need?<select value={orderType} onChange={(e) => setOrderType(e.target.value)}><option>Printing</option><option>Photocopying</option><option>University form</option><option>Binding & finishing</option><option>Stationery purchase</option></select></label>
            <label>Order type<select value={customerType} onChange={(e) => setCustomerType(e.target.value)}><option>Individual</option><option>Group</option></select></label>
            {customerType === 'Group' && <>
              <label>Number of group members<select value={groupMemberCount} onChange={(e) => setGroupMemberCount(Number(e.target.value))}>{Array.from({length: 30}, (_, i) => i + 2).map(n => <option key={n} value={n}>{n} members</option>)}</select></label>
              <div className="group-members-heading"><b>Group member information</b><small>Enter each member's details below.</small></div>
              {Array.from({length: groupMemberCount}, (_, index) => <fieldset className="group-member-card" key={index}><legend>Member {index + 1}</legend><label>Full name<input name={`member_name_${index}`} required placeholder="Member full name" /></label><label>Registration number<input name={`member_registration_${index}`} required placeholder="e.g. T24-..." /></label><label>Phone number<input name={`member_phone_${index}`} required type="tel" placeholder="+255 ..." /></label></fieldset>)}
            </>}
            <label>Full name<input name="customer_name" required placeholder="Your name" /></label>
            <label>Student registration number <input name="registration_number" placeholder="e.g. T24-..." /></label>
            <label>Phone number <input name="phone" required type="tel" placeholder="+255 ..." /></label>
            {orderType !== 'Stationery purchase' && <>
              {orderType !== 'Binding & finishing' && <label>{orderType === 'Printing' ? 'Document: PDF or Word (maximum 20 MB)' : 'Document: PDF or Word (optional, maximum 20 MB)'} <input name="document_file" type="file" accept={DOCUMENT_ACCEPT} required={orderType === 'Printing'} onChange={onDocumentChange} /></label>}
              {PAGE_BASED_TYPES.includes(orderType) && <label>Number of pages <input name="pages" type="number" inputMode="numeric" min="1" max={MAX_PAGES} required value={pages} onChange={(e) => { setPages(e.target.value); setPagesNote(''); }} placeholder="Filled in automatically from your PDF" />
                {pagesNote && <small className="field-note">{pagesNote}</small>}</label>}
              <div className="order-print-options">
                <label>{orderType === 'Binding & finishing' ? 'Documents to bind' : 'Copies'}<input name="copies" type="number" inputMode="numeric" min="1" max={MAX_COPIES} value={copies} onChange={(e) => setCopies(e.target.value)} /></label>
                {(orderType === 'Printing' || orderType === 'University form') && <label>Paper size<select name="paper_size" value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>{PAPER_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>}
                {orderType === 'Printing' && <label>Colour<select name="colour_mode" value={colourMode} onChange={(e) => setColourMode(e.target.value)}>{COLOUR_MODES.map((mode) => <option key={mode}>{mode}</option>)}</select></label>}
              </div>
              {PAGE_BASED_TYPES.includes(orderType) && <label className="check-row"><input type="checkbox" checked={addBinding} onChange={(e) => setAddBinding(e.target.checked)} /> Add binding ({formatTZS(prices.binding)} per document)</label>}
              <div className="price-estimate" aria-live="polite">
                <b className="price-estimate-title">Your cost</b>
                {quote.ready
                  ? <>
                      {quote.lines.map((line) => <div className="price-line" key={line.label}><span>{line.label}</span><b>{formatTZS(line.amount)}</b></div>)}
                      <div className="price-total"><span>Total</span><strong>{formatTZS(quote.total)}</strong></div>
                    </>
                  : <p className="price-wait">{countingPages ? 'Counting the pages in your document…' : 'Attach your document or enter the number of pages to see your cost.'}</p>}
                <small>Rates: black & white {formatTZS(prices.print_bw)} · colour {formatTZS(prices.print_colour)} · photocopy {formatTZS(prices.copy)} · university form {formatTZS(prices.form_page)} (each per page) · binding {formatTZS(prices.binding)} per document. The shop confirms the final amount when it checks your document.</small>
              </div>
            </>}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
              <label>Leave this empty <input name="contact_fax_hp" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <label>Anything else we should know? <textarea name="details" rows="3" placeholder="Optional: binding style, stapling, deadline…" /></label>
            <button className="button button-primary full-button" type="submit" disabled={savingOrder}>{savingOrder ? "Saving order..." : "Submit order"} <ArrowRight size={16} /></button>
          </form>}
          {modal === 'submitted' && <div className="success-state"><span><Check size={25} /></span><h3>Order received</h3><p>Your order has been saved. Keep this tracking reference:</p><strong>{lastOrderReference}</strong><button className="button button-primary" onClick={() => setModal('')}>Got it</button></div>}
          {modal === 'track' && <form className="order-form" onSubmit={trackOrder}><p className="form-intro">Enter the reference given to you after your order is confirmed.</p><label>Order reference<input required value={trackingReference} onChange={e => setTrackingReference(e.target.value)} placeholder="e.g. STN-000123" /></label><button className="button button-primary full-button" disabled={trackingLoading}>{trackingLoading ? 'Checking...' : 'Check order status'} <ArrowRight size={16} /></button>{trackingResult && <div className="tracking-result">{trackingResult.error ? trackingResult.error : <>Status: <b>{trackingResult.status}</b><br/>Order type: {trackingResult.order_type}</>}</div>}</form>}
          {modal === 'support' && <div className="support-content"><p>Need help choosing a service or preparing a document? Contact details will be added once the business phone number and support channel are confirmed.</p><div className="support-placeholder"><Headphones size={22} /><span>Student-friendly support is part of the plan.</span></div></div>}
        </div>
      </div>}
    </div>
  );
}