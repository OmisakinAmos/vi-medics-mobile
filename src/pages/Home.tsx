import { Link } from '../components/Link';
import { ProductCard } from '../components/ProductCard';
import { SectionHeading } from '../components/SectionHeading';
import { ErrorMessage, Loading } from '../components/StatusMessage';
import { categories } from '../data/products';
import { useProducts } from '../hooks';
import type { Navigate, Product } from '../types';

export function Home({ onAdd }: { onNavigate?: Navigate; onAdd: (p: Product) => void }) {
  const { data: products, loading, error } = useProducts();
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">PROFESSIONAL MEDICAL EQUIPMENT</span>
            <h1>Medical equipment for clinics and healthcare professionals, <span>made accessible.</span></h1>
            <p>Discover dependable medical devices and equipment for clinics, diagnostic centres, healthcare professionals and homes across Nigeria — with clear prices and live stock levels.</p>
            <div className="hero-actions"><Link to="/products" className="primary-button">Shop Products <span>→</span></Link><Link to="/products" className="text-button">Explore categories</Link></div>
            <div className="hero-trust"><span>✓ Clear product information</span><span>✓ Stock visibility</span><span>✓ Secure checkout</span></div>
          </div>
          <div className="hero-art"><div className="art-card art-card-back"><span>MEDICAL</span></div><div className="art-card art-card-front"><div className="hero-device"><div className="hero-screen">120<span>/80</span><small>mmHg</small></div><div className="hero-cuff" /></div><div className="art-caption"><span>Featured device</span><strong>Digital BP Monitor</strong></div></div><div className="floating-chip chip-one">✓ In stock</div><div className="floating-chip chip-two">Trusted shopping</div></div>
        </div>
      </section>

      <section className="trust-strip"><div className="container trust-grid"><div><b>✓</b><span><strong>Quality-focused catalogue</strong><small>Clear product information</small></span></div><div><b>⌁</b><span><strong>Simple shopping experience</strong><small>From discovery to checkout</small></span></div><div><b>◉</b><span><strong>Order visibility</strong><small>Keep track of your purchases</small></span></div></div></section>

      <section className="section"><div className="container"><SectionHeading eyebrow="EXPLORE" title="Shop by category" description="Find the equipment you need by category." /><div className="category-grid">{categories.map((category) => <Link to="/products" className="category-card" key={category.name}><span className="category-icon">{category.icon}</span><span><strong>{category.name}</strong><small>{category.description}</small></span><i>↗</i></Link>)}</div></div></section>

      <section className="section section-muted"><div className="container">
        <SectionHeading eyebrow="POPULAR PICKS" title="Featured products" description="A starting catalogue of everyday medical devices and equipment." action={<Link to="/products" className="outline-button">View all products →</Link>} />
        {loading && <Loading label="Loading products…" />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && <div className="product-grid">{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} onAdd={() => onAdd(product)} />)}</div>}
      </div></section>

      <section className="section"><div className="container story-grid"><div><span className="eyebrow">WHY VI-MEDICS</span><h2>A clearer way to shop for medical equipment.</h2><p>Vi-Medics is designed around the questions customers actually need answered: What is this device? How much does it cost? Is it available? And how do I order it?</p><Link to="/products" className="primary-button">Browse the catalogue →</Link></div><div className="feature-panel"><div className="feature-row"><span>01</span><div><strong>Easy to compare</strong><p>Product details, specifications and prices are presented clearly.</p></div></div><div className="feature-row"><span>02</span><div><strong>Stock-aware shopping</strong><p>Availability is visible before customers reach checkout.</p></div></div><div className="feature-row"><span>03</span><div><strong>Orders you can return to</strong><p>Account-based orders are designed to persist beyond a single session.</p></div></div></div></div></section>
    </main>
  );
}
