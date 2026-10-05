import { ProductVisual } from '../components/ProductVisual';
import { DELIVERY_FEE, money } from '../lib/format';
import type { CartItem, Navigate } from '../types';

type Props = { cart: CartItem[]; onNavigate: Navigate; onUpdate: (id: string, q: number) => void; onRemove: (id: string) => void };

export function Cart({ cart, onNavigate, onUpdate, onRemove }: Props) {
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const delivery = cart.length ? DELIVERY_FEE : 0;
  return (
    <main className="page"><div className="container narrow">
      <span className="eyebrow">YOUR CART</span><h1>Shopping cart</h1><p className="page-intro">Review your selected equipment before checkout.</p>
      {cart.length === 0 ? (
        <div className="empty-state large"><span className="empty-icon">🛒</span><h2>Your cart is empty</h2><p>Browse our medical equipment and find what you need.</p><button className="primary-button" onClick={() => onNavigate('/products')}>Shop products →</button></div>
      ) : (
        <div className="cart-layout">
          <div className="cart-list">
            {cart.map((item) => (
              <div className="cart-item" key={item.product.id}>
                <ProductVisual product={item.product} />
                <div className="cart-item-info">
                  <span className="eyebrow">{item.product.category}</span><h3>{item.product.name}</h3><strong>{money(item.product.price)}</strong>
                  <div className="cart-controls">
                    <div className="quantity-control"><button onClick={() => onUpdate(item.product.id, item.quantity - 1)}>-</button><span>{item.quantity}</span><button onClick={() => onUpdate(item.product.id, item.quantity + 1)} disabled={item.quantity >= item.product.stockQuantity}>+</button></div>
                    <button className="remove-button" onClick={() => onRemove(item.product.id)}>Remove</button>
                  </div>
                  {item.quantity >= item.product.stockQuantity && <small>Maximum available quantity selected.</small>}
                </div>
              </div>
            ))}
          </div>
          <aside className="summary">
            <h2>Order summary</h2>
            <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <div><span>Delivery</span><strong>{money(delivery)}</strong></div>
            <hr />
            <div className="summary-total"><span>Total</span><strong>{money(subtotal + delivery)}</strong></div>
            <button className="primary-button wide" onClick={() => onNavigate('/checkout')}>Proceed to checkout →</button>
            <button className="text-button wide" onClick={() => onNavigate('/products')}>Continue shopping</button>
          </aside>
        </div>
      )}
    </div></main>
  );
}
