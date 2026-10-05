import { useEffect, useState } from 'react';
import type { Product } from '../types';

export function ProductVisual({ product, large = false }: { product: Product; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.imageUrl]);

  if (product.imageUrl && !failed) {
    return (
      <div className={`product-visual ${large ? 'product-visual--large' : ''}`} style={{ background: '#fff' }}>
        <img src={product.imageUrl} alt={product.name} loading="lazy" onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    );
  }
  return (
    <div className={`product-visual ${large ? 'product-visual--large' : ''} visual-${product.visual}`} aria-label={`${product.name} product image placeholder`} role="img">
      <div className="visual-glow" />
      <div className="device-shape" />
      <span className="visual-label">VI-MEDICS</span>
    </div>
  );
}
