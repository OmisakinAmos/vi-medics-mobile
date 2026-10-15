import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { DELIVERY_NOTE, money } from '../lib/format';
import { placeOrder, type PlacedOrder } from '../services/orderService';
import type { CartItem, Navigate } from '../types';

type Props = {
  cart: CartItem[];
  onNavigate: Navigate;
  onRequireLogin: () => void;
  onPlaced: (order: PlacedOrder) => void;
};

export function Checkout({ cart, onNavigate, onRequireLogin, onPlaced }: Props) {
  const { user, enabled, loading: authLoading } = useAuth();
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const [form, setForm] = useState({ name: (user?.user_metadata?.full_name as string) ?? '', email: user?.email ?? '', phone: '', address: '', city: '', state: '', country: 'Nigeria' });
  // After a page reload the sign-in finishes loading after the form was created, so fill in name and email once they are known.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({ ...f, name: f.name || (user.user_metadata?.full_name as string | undefined) || '', email: f.email || user.email || '' }));
  }, [user?.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const order = await placeOrder(cart, form);
      onPlaced(order);
      onNavigate('/payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not place your order. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const needsLogin = enabled && !authLoading && !user;

  return (
    <main className="page"><div className="container narrow">
      <button className="breadcrumb" onClick={() => onNavigate('/cart')}>← Back to cart</button>
      <span className="eyebrow">CHECKOUT</span><h1>Complete your order</h1>
      <div className="checkout-grid">
        {needsLogin ? (
          <div className="form-card">
            <h2>Sign in to place your order</h2>
            <p>Your order is saved to your account so you can view it later.</p>
            <button className="primary-button wide" onClick={onRequireLogin}>Sign in or create account →</button>
          </div>
        ) : (
          <form className="checkout-form" onSubmit={submit}>
            <div className="form-card"><h2>Customer information</h2><div className="form-grid"><label>Full name<input required value={form.name} onChange={set('name')} placeholder="Your full name" /></label><label>Email<input required type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" /></label><label>Phone number<input required value={form.phone} onChange={set('phone')} placeholder="0800 000 0000" /></label></div></div>
            <div className="form-card"><h2>Delivery information</h2><div className="form-grid"><label className="full">Address<input required value={form.address} onChange={set('address')} placeholder="Street address" /></label><label>City<input required value={form.city} onChange={set('city')} placeholder="Lagos" /></label><label>State<input required value={form.state} onChange={set('state')} placeholder="Lagos" /></label><label>Country<select value={form.country} onChange={set('country')}><option>Nigeria</option></select></label></div></div>
            <div className="checkout-note">You pay by <strong>bank transfer</strong>. Tap the button below to save your order and see our account details. Your items are reserved while you pay. The delivery fee depends on distance and is agreed with you separately, so it is not part of this total.</div>
            {error && <div role="alert" style={{ color: '#b42318', fontSize: 14 }}>{error}</div>}
            <button className="primary-button wide" type="submit" disabled={cart.length === 0 || busy || !enabled}>{busy ? 'Saving your order…' : `Pay ${money(subtotal)} by bank transfer →`}</button>
            {!enabled && <small>Ordering is unavailable because the database is not configured.</small>}
          </form>
        )}
        <aside className="summary checkout-summary">
          <h2>Order summary</h2>
          {cart.length === 0 ? <p>Your cart is empty.</p> : cart.map((item) => <div key={item.product.id}><span>{item.product.name} × {item.quantity}</span><strong>{money(item.product.price * item.quantity)}</strong></div>)}
          <hr />
          <div><span>Delivery</span><strong>{DELIVERY_NOTE}</strong></div>
          <div className="summary-total"><span>Total</span><strong>{money(subtotal)}</strong></div>
        </aside>
      </div>
    </div></main>
  );
}
