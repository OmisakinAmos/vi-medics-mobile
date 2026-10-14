import type { PlacedOrder, ReceiptResult } from '../services/orderService';
import type { Navigate } from '../types';

/** Final step after the receipt: a plain thank-you with no receipt on it. */
export function ThankYou({ order, receipt, onNavigate }: { order: PlacedOrder | null; receipt: ReceiptResult | null; onNavigate: Navigate }) {
  return (
    <main className="auth-page"><div className="confirmation-card">
      <div className="success-icon">✓</div>
      <span className="eyebrow">ORDER RECEIVED</span>
      <h1>Thank you for your order.</h1>
      <p>
        {order ? <>Your order <strong>#{order.orderNumber}</strong> has been received. </> : 'Your order has been received. '}
        We will confirm your payment and arrange delivery. You can follow its progress any time under My Orders.
        {receipt === 'sent' && ' Your receipt has also been emailed to you.'}
      </p>
      <div className="hero-actions">
        <button className="primary-button" onClick={() => onNavigate('/account')}>View my orders →</button>
        <button className="outline-button" onClick={() => onNavigate('/products')}>Continue shopping</button>
      </div>
    </div></main>
  );
}
