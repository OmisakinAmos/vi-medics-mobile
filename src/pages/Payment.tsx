import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { ErrorMessage, Loading } from '../components/StatusMessage';
import { money } from '../lib/format';
import { getMyOrder, getPaymentDetails, reportPayment, requestReceiptEmail, type PaymentDetails, type PlacedOrder, type ReceiptResult } from '../services/orderService';
import type { Navigate, Order } from '../types';

type Props = {
  order: PlacedOrder | null;
  onNavigate: Navigate;
  onRequireLogin: () => void;
  onPaid: (order: PlacedOrder, receipt: ReceiptResult) => void;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard unavailable: the number is still on screen */ }
  };
  return <button type="button" className="copy-button" onClick={copy} aria-label={`Copy ${label}`}>{copied ? 'Copied ✓' : 'Copy'}</button>;
}

/** Step 2 of checkout: shows what to pay and where. "I have paid" records the payment and sends the receipt. */
export function Payment({ order: placed, onNavigate, onRequireLogin, onPaid }: Props) {
  const { user, session, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [bank, setBank] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!placed || !user) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    Promise.all([getMyOrder(placed.id), getPaymentDetails()])
      .then(([o, b]) => { if (active) { setOrder(o); setBank(b); setError(null); } })
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [placed?.id, user?.id]);

  if (authLoading) return <main className="page"><div className="container narrow"><Loading /></div></main>;

  if (!user) {
    return (
      <main className="page"><div className="container narrow">
        <div className="empty-state large"><h2>Sign in to continue</h2><p>Sign in to see the payment details for your order.</p><button className="primary-button" onClick={onRequireLogin}>Sign in →</button></div>
      </div></main>
    );
  }

  if (!placed) {
    return (
      <main className="page"><div className="container narrow">
        <div className="empty-state large"><h2>No order to pay for</h2><p>Your unpaid orders are listed in My Orders, where you can complete payment.</p><button className="primary-button" onClick={() => onNavigate('/account')}>View my orders →</button></div>
      </div></main>
    );
  }

  if (loading) return <main className="page"><div className="container narrow"><Loading label="Loading payment details…" /></div></main>;
  if (error || !order) return <main className="page"><div className="container narrow"><ErrorMessage message={error ?? 'Order not found.'} /></div></main>;

  const bankReady = Boolean(bank?.accountNumber && bank?.accountName);
  const alreadyPaid = order.paymentStatus !== 'awaiting';
  const cancelled = order.status === 'cancelled';

  const iHavePaid = async () => {
    if (!window.confirm('Only continue if you have already made the bank transfer. Have you paid?')) return;
    setBusy(true);
    setError(null);
    try {
      await reportPayment(order.id);
      const receipt: ReceiptResult = session ? await requestReceiptEmail(order.id, session.access_token) : 'failed';
      onPaid(placed, receipt);
      onNavigate('/confirmation');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record your payment. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page"><div className="container narrow">
      <button className="breadcrumb" onClick={() => onNavigate('/account')}>← My orders</button>
      <span className="eyebrow">PAYMENT</span><h1>Pay by bank transfer</h1>
      <div className="checkout-grid">
        <div className="checkout-form">
          <div className="form-card pay-total">
            <span>Amount to transfer</span>
            <strong>{money(order.total)}</strong>
            <small>Order #{order.orderNumber} · includes {money(order.deliveryFee)} delivery</small>
          </div>

          {cancelled && <div className="admin-error">This order was cancelled, so it can no longer be paid for.</div>}

          {!cancelled && (
            <div className="form-card">
              <h2>Our bank details</h2>
              {bankReady ? (
                <dl className="bank-details">
                  {bank?.bankName && <div><dt>Bank</dt><dd>{bank.bankName}</dd></div>}
                  <div><dt>Account name</dt><dd>{bank?.accountName}<CopyButton value={bank?.accountName ?? ''} label="account name" /></dd></div>
                  <div><dt>Account number</dt><dd className="bank-number">{bank?.accountNumber}<CopyButton value={bank?.accountNumber ?? ''} label="account number" /></dd></div>
                  <div><dt>Amount</dt><dd>{money(order.total)}</dd></div>
                  <div><dt>Reference</dt><dd>{order.orderNumber}<CopyButton value={order.orderNumber} label="order reference" /></dd></div>
                </dl>
              ) : (
                <p className="admin-hint">Our bank details are not available right now. Please call us on +234 811 386 7495 and we will give you the account to pay into. Your order is saved.</p>
              )}
              <ol className="pay-steps">
                <li>Transfer exactly <strong>{money(order.total)}</strong> to the account above. Put <strong>{order.orderNumber}</strong> as the reference or narration.</li>
                <li>When the transfer is done, tap <strong>I have paid</strong>.</li>
                <li>We email your receipt straight away, then confirm the payment and deliver your order.</li>
              </ol>
              {error && <div role="alert" className="admin-error" style={{ marginBottom: 12 }}>{error}</div>}
              {alreadyPaid ? (
                <>
                  <div className="admin-notice">You have already told us this order is paid. {order.paymentStatus === 'confirmed' ? 'Payment is confirmed.' : 'We will confirm it shortly.'}</div>
                  <button className="primary-button wide" onClick={() => onNavigate('/confirmation')}>View receipt →</button>
                </>
              ) : (
                <button className="primary-button wide" disabled={busy || !bankReady} onClick={iHavePaid}>{busy ? 'Recording your payment…' : 'I have paid ✓'}</button>
              )}
              <small className="pay-note">Your order is held for you until payment is confirmed. Your items are reserved in the meantime.</small>
            </div>
          )}
        </div>
        <aside className="summary checkout-summary">
          <h2>Order #{order.orderNumber}</h2>
          {order.items.map((i) => <div key={i.id}><span>{i.productName} × {i.quantity}</span><strong>{money(i.unitPrice * i.quantity)}</strong></div>)}
          <hr />
          <div><span>Subtotal</span><strong>{money(order.subtotal)}</strong></div>
          <div><span>Delivery</span><strong>{money(order.deliveryFee)}</strong></div>
          <div className="summary-total"><span>Total</span><strong>{money(order.total)}</strong></div>
          <hr />
          <div><span>Deliver to</span><strong style={{ textAlign: 'right' }}>{order.address}, {order.city}, {order.state}</strong></div>
        </aside>
      </div>
    </div></main>
  );
}
