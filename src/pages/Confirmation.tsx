import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { ErrorMessage, Loading } from '../components/StatusMessage';
import { PAYMENT_LABEL, formatDateTime, money } from '../lib/format';
import { PHONE_DISPLAY } from '../lib/contact';
import { getMyOrder, type PlacedOrder, type ReceiptResult } from '../services/orderService';
import type { Navigate, Order } from '../types';

type Props = { order: PlacedOrder | null; receipt: ReceiptResult | null; onNavigate: Navigate };

/** Shown after "I have paid": the on-screen receipt (also emailed to the customer). */
export function Confirmation({ order: placed, receipt, onNavigate }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(Boolean(placed));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!placed || !user) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    getMyOrder(placed.id)
      .then((o) => active && (setOrder(o), setError(null)))
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [placed?.id, user?.id]);

  if (authLoading || loading) return <main className="page"><div className="container narrow"><Loading label="Preparing your receipt…" /></div></main>;

  if (!placed || !user) {
    return (
      <main className="auth-page"><div className="confirmation-card">
        <h1>No recent order</h1><p>Place an order or check your order history.</p>
        <div className="hero-actions"><button className="primary-button" onClick={() => onNavigate('/account')}>View my orders →</button><button className="outline-button" onClick={() => onNavigate('/products')}>Continue shopping</button></div>
      </div></main>
    );
  }
  if (error || !order) return <main className="page"><div className="container narrow"><ErrorMessage message={error ?? 'Order not found.'} /></div></main>;

  if (order.paymentStatus === 'awaiting') {
    return (
      <main className="auth-page"><div className="confirmation-card">
        <span className="eyebrow">ORDER SAVED</span><h1>Waiting for your payment.</h1>
        <p>Order <strong>#{order.orderNumber}</strong> is saved. Your receipt is created once you tell us you have paid.</p>
        <div className="hero-actions"><button className="primary-button" onClick={() => onNavigate('/payment')}>Go to payment →</button><button className="outline-button" onClick={() => onNavigate('/account')}>My orders</button></div>
      </div></main>
    );
  }

  const emailLine =
    receipt === 'sent' ? `A copy of this receipt has been emailed to ${order.customerEmail}.`
    : receipt === 'skipped' || receipt === 'failed' ? `We could not email the receipt just now. You can print or save it from this page, and it stays available in My Orders.`
    : `Your receipt is available any time from My Orders.`;
  const receiptNo = `RCT-VM-${order.orderNumber.replace(/^VM-/, '')}`;

  return (
    <main className="page"><div className="container narrow">
      <div className="receipt-intro no-print">
        <div className="success-icon">✓</div>
        <h1>Here is your receipt.</h1>
        <p>{receipt !== null && 'Save or print it, then tap Done. '}{order.paymentStatus === 'confirmed' ? 'Your payment is confirmed.' : 'We will confirm your payment once the transfer reflects in our account, then arrange delivery.'} {emailLine}</p>
      </div>

      <article className="receipt" id="receipt">
        <header className="receipt-head">
          <div><img src="/logo.png" alt="Vi-Medics" className="receipt-logo" /></div>
          <div className="receipt-company"><strong>Vi-Medics</strong><span>Medical Equipment, Supplies &amp; Servicing</span><span>{PHONE_DISPLAY}</span><span>vi-medics.vercel.app</span></div>
        </header>
        <h2>Payment receipt</h2>
        <dl className="receipt-meta">
          <div><dt>Receipt no.</dt><dd>{receiptNo}</dd></div>
          <div><dt>Order</dt><dd>#{order.orderNumber}</dd></div>
          <div><dt>Date</dt><dd>{formatDateTime(order.paidReportedAt ?? order.createdAt)}</dd></div>
          <div><dt>Payment method</dt><dd>Bank transfer</dd></div>
          <div><dt>Status</dt><dd>{PAYMENT_LABEL[order.paymentStatus]}</dd></div>
        </dl>
        <table className="receipt-table">
          <thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Amount</th></tr></thead>
          <tbody>{order.items.map((i) => <tr key={i.id}><td>{i.productName}</td><td>{money(i.unitPrice)}</td><td>{i.quantity}</td><td>{money(i.unitPrice * i.quantity)}</td></tr>)}</tbody>
          <tfoot>
            <tr><td colSpan={3}>Subtotal</td><td>{money(order.subtotal)}</td></tr>
            <tr><td colSpan={3}>Delivery</td><td>{money(order.deliveryFee)}</td></tr>
            <tr className="receipt-total"><td colSpan={3}>Total</td><td>{money(order.total)}</td></tr>
          </tfoot>
        </table>
        <div className="receipt-deliver"><strong>Delivery details</strong><span>{order.customerName}</span><span>{order.address}, {order.city}, {order.state}, {order.country}</span><span>{order.customerPhone} · {order.customerEmail}</span></div>
        <p className="receipt-foot">Thank you for shopping with Vi-Medics.</p>
      </article>

      <div className="hero-actions no-print" style={{ marginTop: 18 }}>
        <button className="primary-button" onClick={() => window.print()}>Print / save as PDF</button>
        {receipt !== null
          ? <button className="outline-button" onClick={() => onNavigate('/thank-you')}>Done →</button>
          : <button className="outline-button" onClick={() => onNavigate('/account')}>Back to my orders</button>}
      </div>
    </div></main>
  );
}
