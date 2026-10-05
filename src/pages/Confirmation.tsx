import { money } from '../lib/format';
import type { PlacedOrder } from '../services/orderService';
import type { Navigate } from '../types';

export function Confirmation({ order, onNavigate }: { order: PlacedOrder | null; onNavigate: Navigate }) {
  if (!order) {
    return (
      <main className="auth-page"><div className="confirmation-card">
        <h1>No recent order</h1><p>Place an order or check your order history.</p>
        <div className="hero-actions"><button className="primary-button" onClick={() => onNavigate('/account')}>View my orders →</button><button className="outline-button" onClick={() => onNavigate('/products')}>Continue shopping</button></div>
      </div></main>
    );
  }
  return (
    <main className="auth-page"><div className="confirmation-card">
      <div className="success-icon">✓</div><span className="eyebrow">ORDER CONFIRMED</span><h1>Thank you for your order.</h1>
      <p>Your order <strong>#{order.orderNumber}</strong> has been received and saved to your account. A confirmation email is on its way.</p>
      <div className="confirmation-total">Total <strong>{money(order.total)}</strong></div>
      <div className="hero-actions"><button className="primary-button" onClick={() => onNavigate('/account')}>View my orders →</button><button className="outline-button" onClick={() => onNavigate('/products')}>Continue shopping</button></div>
    </div></main>
  );
}
