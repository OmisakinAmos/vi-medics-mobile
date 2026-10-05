import { ProductVisual } from '../components/ProductVisual';
import { ErrorMessage, Loading } from '../components/StatusMessage';
import { useProduct } from '../hooks';
import { money } from '../lib/format';
import type { Navigate, Product } from '../types';

function Spec({ label, value }: { label: string; value: string }) {
  return <div className="spec"><span>{label}</span><strong>{value}</strong></div>;
}

export function ProductDetails({ id, onNavigate, onAdd }: { id: string; onNavigate: Navigate; onAdd: (p: Product) => void }) {
  const { data: product, loading, error } = useProduct(id);

  if (loading) return <main className="page"><div className="container"><Loading label="Loading product…" /></div></main>;
  if (error) return <main className="page"><div className="container"><ErrorMessage message={error} /></div></main>;
  if (!product) {
    return (
      <main className="page"><div className="container">
        <button className="breadcrumb" onClick={() => onNavigate('/products')}>← Back to products</button>
        <div className="empty-state"><strong>Product not found</strong><p>This product may no longer be available.</p></div>
      </div></main>
    );
  }

  const outOfStock = product.stockQuantity <= 0;
  const low = !outOfStock && product.stockQuantity <= 3;
  const extraSpecs = Object.entries(product.specifications ?? {});

  return (
    <main className="page"><div className="container">
      <button className="breadcrumb" onClick={() => onNavigate('/products')}>← Back to products</button>
      <div className="details-grid">
        <ProductVisual product={product} large />
        <div className="details-copy">
          <span className="eyebrow">{product.category.toUpperCase()}</span>
          <h1>{product.name}</h1>
          <p className="details-description">{product.description}</p>
          <div className="detail-price">{money(product.price)}</div>
          <div className={`detail-stock ${outOfStock || low ? 'warning' : ''}`}>● {outOfStock ? 'Out of stock' : low ? `Low stock — ${product.stockQuantity} remaining` : `${product.stockQuantity} units in stock`}</div>
          <div className="quantity-row"><span>Quantity</span><div><button>-</button><strong>1</strong><button>+</button></div></div>
          <button className="primary-button wide" disabled={outOfStock} onClick={() => { onAdd(product); onNavigate('/cart'); }}>{outOfStock ? 'Currently unavailable' : <>Add to cart <span>→</span></>}</button>
          <div className="detail-points"><span>✓ Product details displayed clearly</span><span>✓ Stock checked before checkout</span><span>✓ Order history after authentication</span></div>
        </div>
      </div>
      <div className="specs-section">
        <div><span className="eyebrow">PRODUCT INFORMATION</span><h2>Specifications</h2></div>
        <div className="spec-grid">
          <Spec label="Brand" value={product.brand} />
          <Spec label="Model" value={product.model} />
          <Spec label="Category" value={product.category} />
          <Spec label="Warranty" value={product.warranty} />
          {extraSpecs.map(([label, value]) => <Spec key={label} label={label} value={value} />)}
        </div>
      </div>
    </div></main>
  );
}
