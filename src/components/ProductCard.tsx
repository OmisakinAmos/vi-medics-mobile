import { money } from '../lib/format';
import type { Product } from '../types';
import { Link } from './Link';
import { ProductVisual } from './ProductVisual';

export function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  const outOfStock = product.stockQuantity <= 0;
  const low = !outOfStock && product.stockQuantity <= 3;
  const stockClass = outOfStock ? 'low' : low ? 'low' : 'in';
  const stockLabel = outOfStock ? 'Out of stock' : low ? `Only ${product.stockQuantity} left` : 'In stock';
  return (
    <article className="product-card">
      <Link to={`/product/${product.id}`} className="product-image-button" aria-label={`View ${product.name}`}><ProductVisual product={product} /></Link>
      <div className="product-info">
        <div className="product-meta"><span>{product.category}</span><span className={`stock stock-${stockClass}`}>{stockLabel}</span></div>
        <h3 className="product-name-heading"><Link to={`/product/${product.id}`} className="product-name">{product.name}</Link></h3>
        <p>{product.description}</p>
        <div className="product-bottom">
          <strong>{money(product.price)}</strong>
          <button className="add-button" onClick={onAdd} disabled={outOfStock}>{outOfStock ? 'Unavailable' : 'Add to cart'}</button>
        </div>
      </div>
    </article>
  );
}
