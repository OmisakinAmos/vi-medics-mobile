import { Link } from '../components/Link';
import { PHONE_DISPLAY, PHONE_TEL, whatsappLink } from '../lib/contact';

const offers = [
  { icon: '🔧', title: 'Repairs', text: 'Fault finding and repair of medical equipment that has stopped working or is not performing as it should.' },
  { icon: '🗓', title: 'Preventive maintenance', text: 'Routine servicing to keep equipment in good working order and reduce unexpected breakdowns.' },
  { icon: '✓', title: 'Inspection and checks', text: 'Inspection and functional checks carried out by our biomedical engineers, with the findings explained to you.' },
];

const steps = [
  { title: 'Tell us about the equipment', text: 'Send the equipment type, brand, model and what the problem is. Photos help.' },
  { title: 'We assess it', text: 'Our biomedical engineers review the details and advise on the work needed.' },
  { title: 'We repair or service it', text: 'We carry out the agreed work and let you know when the equipment is ready.' },
];

const REQUEST_MESSAGE = 'Hello Vi-Medics, I would like to request equipment maintenance/servicing.\nEquipment: \nBrand/model: \nProblem or service needed: \nLocation: ';

export function Services() {
  return (
    <main className="page"><div className="container">
      <div className="page-heading">
        <div>
          <span className="eyebrow">BIOMEDICAL ENGINEERING</span>
          <h1>Equipment maintenance and servicing</h1>
          <p>Our biomedical engineering team repairs and maintains medical equipment for clinics, diagnostic centres, healthcare professionals and homes.</p>
        </div>
      </div>

      <div className="service-cta">
        <a className="primary-button" href={whatsappLink(REQUEST_MESSAGE)} target="_blank" rel="noopener noreferrer">Request a service on WhatsApp <span>→</span></a>
        <a className="outline-button" href={PHONE_TEL}>Call {PHONE_DISPLAY}</a>
      </div>

      <section className="info-section">
        <h2>What we do</h2>
        <div className="info-grid">
          {offers.map((o) => (
            <div className="info-card" key={o.title}><span className="info-icon" aria-hidden="true">{o.icon}</span><strong>{o.title}</strong><p>{o.text}</p></div>
          ))}
        </div>
      </section>

      <section className="info-section">
        <h2>How it works</h2>
        <ol className="step-list">
          {steps.map((s, i) => (
            <li key={s.title}><span>{i + 1}</span><div><strong>{s.title}</strong><p>{s.text}</p></div></li>
          ))}
        </ol>
      </section>

      <div className="feature-panel service-note">
        <h2>Need equipment or supplies instead?</h2>
        <p>Browse our medical equipment and consumables, with clear prices and live stock levels.</p>
        <Link to="/products" className="outline-button">Browse products →</Link>
      </div>
    </div></main>
  );
}
