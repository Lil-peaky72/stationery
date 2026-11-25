import { useMemo, useState } from 'react';
import {
  ArrowRight, BookOpen, Check, ChevronDown, Clock3, FileText,
  Headphones, Menu, Minus, Plus, Printer, Search, ShieldCheck,
  ShoppingBag, ShoppingCart, Sparkles, UploadCloud, X
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
  { icon: Printer, title: 'Document printing', text: 'Clear black & white or colour prints for notes, reports and coursework.' },
  { icon: FileText, title: 'Photocopying', text: 'Sharp, reliable copies for class materials and important documents.' },
  { icon: BookOpen, title: 'Binding & finishing', text: 'Neat spiral, comb and premium finishes for assignments and projects.' }
];

const money = (amount) => new Intl.NumberFormat('en-TZ', {
  style: 'currency', currency: 'TZS', maximumFractionDigits: 0
}).format(amount);

export default function App() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [modal, setModal] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [orderType, setOrderType] = useState('Printing');
  const [notice, setNotice] = useState('');

  const categories = ['All', 'Books', 'Writing', 'Organisation', 'Study tools'];
  const visibleProducts = useMemo(() => products.filter((product) => {
    const categoryMatch = activeCategory === 'All' || product.category === activeCategory;
    const searchMatch = (product.name + product.detail).toLowerCase().includes(search.toLowerCase());
    return categoryMatch && searchMatch;
  }), [activeCategory, search]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
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

  function openOrder(type) {
    setOrderType(type);
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
          <span className="brand-mark"><Printer size={21} strokeWidth={2.2} /></span>
          <span>stationery<span className="brand-dot">.</span><small>PRINT · BIND · SUPPLY</small></span>
        </a>
        <button className="mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation">{mobileMenu ? <X /> : <Menu />}</button>
        <nav className={mobileMenu ? 'nav-links nav-open' : 'nav-links'}>
          <button onClick={() => scrollTo('home')}>Home</button>
          <button onClick={() => scrollTo('services')}>Printing services</button>
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

        <section className="section-wrap services-section" id="services">
          <div className="section-heading">
            <div><div className="eyebrow">WHAT WE CAN DO FOR YOU</div><h2>Print work. <em>Less worry.</em></h2></div>
            <p>All the essentials for your academic journey, brought together in one simple place.</p>
          </div>
          <div className="service-grid">
            {services.map(({ icon: Icon, title, text }, index) => (
              <article className="service-card" key={title}>
                <div className="service-icon">{<Icon size={23} />}</div>
                <span className="service-number">0{index + 1}</span>
                <h3>{title}</h3><p>{text}</p>
                <button className="text-link" onClick={() => openOrder(title)}>Request service <ArrowRight size={15} /></button>
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
        <div className="section-wrap footer-inner"><div className="brand footer-brand"><span className="brand-mark"><Printer size={21} /></span><span>stationery<span className="brand-dot">.</span><small>PRINT · BIND · SUPPLY</small></span></div><p>Helping students get their best work out into the world.</p><div className="footer-bottom"><span>© 2026 Stationery. Built for students.</span><button onClick={() => setModal('support')}>Need help? Contact support <ArrowRight size={14} /></button></div></div>
      </footer>

      {notice && <div className="toast"><Check size={16} />{notice}</div>}

      {modal && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(''); }}>
        <div className="modal-panel">
          <div className="modal-header"><div><span className="eyebrow">STATIONERY / STUDENT SERVICES</span><h2>{modal === 'cart' ? 'Your bag' : modal === 'track' ? 'Track an order' : modal === 'support' ? "We're here to help" : modal === 'order' ? 'Start an order' : 'Your request'}</h2></div><button className="close-modal" onClick={() => setModal('')} aria-label="Close"><X /></button></div>
          {modal === 'cart' && <div className="cart-content">{cart.length === 0 ? <div className="empty-cart"><ShoppingCart size={32} /><h3>Your bag is waiting</h3><p>Add stationery essentials from the shop to see them here.</p><button className="button button-primary" onClick={() => { setModal(''); scrollTo('shop'); }}>Browse the shop</button></div> : <><div className="cart-items">{cart.map((item) => <div className="cart-row" key={item.id}><span className="cart-emoji">{item.icon}</span><div className="cart-item-name"><b>{item.name}</b><small>{money(item.price)} each</small></div><div className="quantity"><button onClick={() => changeQuantity(item.id, -1)}><Minus size={13} /></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)}><Plus size={13} /></button></div><b>{money(item.price * item.quantity)}</b></div>)}</div><div className="cart-total"><span>Estimated total</span><b>{money(cartTotal)}</b></div><p className="form-hint">Checkout and payment will be connected in a later development phase.</p><button className="button button-primary full-button" onClick={() => { setModal('order'); setOrderType('Stationery purchase'); }}>Continue with request <ArrowRight size={16} /></button></>}</div>}
          {modal === 'order' && <form className="order-form" onSubmit={(e) => { e.preventDefault(); setModal('submitted'); }}>
            <p className="form-intro">Tell us what you need. This prototype previews the request form; it does not yet send or store orders.</p>
            <label>What do you need?<select value={orderType} onChange={(e) => setOrderType(e.target.value)}><option>Printing</option><option>Photocopying</option><option>Binding & finishing</option><option>Stationery purchase</option></select></label>
            <label>Full name<input required placeholder="Your name" /></label>
            <label>Student registration number <input placeholder="e.g. T24-..." /></label>
            <label>Phone number <input required type="tel" placeholder="+255 ..." /></label>
            {orderType !== 'Stationery purchase' && <label>Document file <input type="file" accept=".pdf,.doc,.docx" /></label>}
            <label>Order details <textarea rows="3" placeholder="Number of pages, copies, colour or black & white, binding type..." /></label>
            <button className="button button-primary full-button" type="submit">Review request <ArrowRight size={16} /></button>
          </form>}
          {modal === 'submitted' && <div className="success-state"><span><Check size={25} /></span><h3>Request preview complete</h3><p>This is only a frontend demonstration. Your request has not been sent to a shop or saved yet.</p><button className="button button-primary" onClick={() => setModal('')}>Got it</button></div>}
          {modal === 'track' && <form className="order-form" onSubmit={(e) => { e.preventDefault(); setNotice('Tracking will be available when order services are connected.'); setModal(''); window.setTimeout(() => setNotice(''), 3000); }}><p className="form-intro">Enter the reference given to you after your order is confirmed.</p><label>Order reference<input required placeholder="e.g. STN-000123" /></label><button className="button button-primary full-button">Check order status <ArrowRight size={16} /></button><p className="form-hint">Live tracking will be connected to the order database in a later phase.</p></form>}
          {modal === 'support' && <div className="support-content"><p>Need help choosing a service or preparing a document? Contact details will be added once the business phone number and support channel are confirmed.</p><div className="support-placeholder"><Headphones size={22} /><span>Student-friendly support is part of the plan.</span></div></div>}
        </div>
      </div>}
    </div>
  );
}