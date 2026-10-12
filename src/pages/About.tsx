import { Link } from '../components/Link';
import { PHONE_DISPLAY, PHONE_TEL } from '../lib/contact';

const pillars = [
  { icon: '◉', title: 'Medical equipment', text: 'Monitoring, diagnostic, respiratory and mobility equipment for clinics, diagnostic centres, healthcare professionals and homes.', to: '/products', cta: 'Shop equipment' },
  { icon: '▢', title: 'Disposable supplies', text: 'Everyday disposable medical supplies such as gloves, syringes, masks and swabs, ready to reorder when stock runs low.', to: '/products', cta: 'Shop disposables' },
  { icon: '🔧', title: 'Maintenance and servicing', text: 'Our biomedical engineering team repairs and maintains medical equipment so it stays in good working order.', to: '/services', cta: 'Request servicing' },
];

const commitments = [
  { title: 'Clear information', text: 'Each product shows its price, brand, model, warranty and specifications so you can compare before you buy.' },
  { title: 'Honest stock levels', text: 'Availability is visible on every product. Items that are out of stock cannot be ordered.' },
  { title: 'Orders you can return to', text: 'Sign in to place an order, receive an email confirmation and find your order history whenever you need it.' },
  { title: 'Support after the sale', text: 'Our biomedical engineers can look after the equipment you buy, or equipment you already own.' },
];

const audiences = [
  { title: 'Clinics and diagnostic centres', text: 'Equip and restock your facility, and keep your equipment maintained.' },
  { title: 'Healthcare professionals', text: 'Reliable instruments and supplies for your practice.' },
  { title: 'Families and individuals', text: 'Devices for personal and home use, explained in plain language.' },
];

export function About() {
  return (
    <main className="page"><div className="container narrow">
      <span className="eyebrow">ABOUT VI-MEDICS</span>
      <h1>Medical equipment, supplies and servicing, in one place.</h1>
      <p className="page-intro">Vi-Medics is a Lagos-based supplier of medical equipment and disposable medical supplies, with a biomedical engineering team that repairs and maintains equipment. We serve clinics, diagnostic centres, healthcare professionals and families across Nigeria.</p>

      <section className="info-section">
        <h2>Who we are</h2>
        <p className="about-text">Buying medical equipment should not be guesswork. We built Vi-Medics so that the people who depend on it can see what a product is, what it costs and whether it is available, then order it with confidence.</p>
        <p className="about-text">We go beyond selling. The same team that supplies your equipment can repair and maintain it, so you have one trusted contact for what you buy and for keeping it working.</p>
      </section>

      <section className="info-section">
        <h2>What we offer</h2>
        <div className="info-grid">
          {pillars.map((p) => (
            <div className="info-card" key={p.title}>
              <span className="info-icon" aria-hidden="true">{p.icon}</span><strong>{p.title}</strong><p>{p.text}</p>
              <Link to={p.to} className="info-link">{p.cta} →</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="info-section">
        <h2>How we work</h2>
        <div className="feature-panel">
          {commitments.map((c, i) => (
            <div className="feature-row" key={c.title}><span>{String(i + 1).padStart(2, '0')}</span><div><strong>{c.title}</strong><p>{c.text}</p></div></div>
          ))}
        </div>
      </section>

      <section className="info-section">
        <h2>Who we serve</h2>
        <div className="info-grid">
          {audiences.map((a) => (
            <div className="info-card" key={a.title}><strong>{a.title}</strong><p>{a.text}</p></div>
          ))}
        </div>
      </section>

      <div className="feature-panel service-note">
        <h2>Talk to us</h2>
        <p>Questions about a product, an order or equipment servicing? Call <a href={PHONE_TEL}>{PHONE_DISPLAY}</a> — we are based in Lagos, Nigeria.</p>
        <div className="service-cta">
          <Link to="/products" className="primary-button">Browse products →</Link>
          <Link to="/services" className="outline-button">Equipment servicing</Link>
        </div>
      </div>
    </div></main>
  );
}
