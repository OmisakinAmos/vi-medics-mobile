import { money } from '../lib/format';
import type { Product } from '../types';
import { ProductVisual } from './ProductVisual';

export function ProductCard({ product, onView, onAdd }: { product: Product; onView: () => void; onAdd: () => void }) {
  const outOfStock = product.stockQuantity <= 0;
  const low = !outOfStock && product.stockQuantity <= 3;
  const stockClass = outOfStock ? 'low' : low ? 'low' : 'in';
  const stockLabel = outOfStock ? 'Out of stock' : low ? `Only ${product.stockQuantity} left` : 'In stock';
  return (
    <article className="product-card">
      <button className="product-image-button" onClick={onView}><ProductVisual product={product} /></button>
      <div className="product-info">
        <div className="product-meta"><span>{product.category}</span><span className={`stock stock-${stockClass}`}>{stockLabel}</span></div>
        <button className="product-name" onClick={onView}>{product.name}</button>
        <p>{product.description}</p>
        <div className="product-bottom">
          <strong>{money(product.price)}</strong>
          <button className="add-button" onClick={onAdd} disabled={outOfStock}>{outOfStock ? 'Unavailable' : 'Add to cart'}</button>
        </div>
      </div>
    </article>
  );
}
