import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { ErrorMessage, Loading } from '../components/StatusMessage';
import { DELIVERY_NOTE, PAYMENT_LABEL, formatDateTime, money } from '../lib/format';
import { checkIsAdmin } from '../services/adminService';
import { cancelMyOrder, listMyOrders } from '../services/orderService';
import type { PlacedOrder } from '../services/orderService';
import type { Navigate, Order } from '../types';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export function Account({ onNavigate, onPay, onViewReceipt }: { onNavigate: Navigate; onPay: (order: PlacedOrder) => void; onViewReceipt: (order: PlacedOrder) => void }) {
  const { user, loading: authLoading, signOut } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this order? Your reserved items will be released.')) return;
    setCancelling(id);
    try {
      await cancelMyOrder(id);
      setOrders((list) => list.map((o) => (o.id === id ? { ...o, status: 'cancelled' } : o)));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCancelling(null);
    }
  };

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    let active = true;
    checkIsAdmin().then((ok) => active && setIsAdmin(ok)).catch(() => undefined);
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    listMyOrders()
      .then((o) => active && (setOrders(o), setError(null)))
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user?.id]);

  if (authLoading) return <main className="page"><div className="container narrow"><Loading /></div></main>;

  if (!user) {
    return (
      <main className="page"><div className="container narrow">
        <div className="empty-state large"><h2>Sign in to see your orders</h2><p>Your orders are saved to your account.</p><button className="primary-button" onClick={() => onNavigate('/login')}>Sign in →</button></div>
      </div></main>
    );
  }

  const name = (user.user_metadata?.full_name as string | undefined) || user.email || 'Customer';
  const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <main className="page"><div className="container narrow">
      <span className="eyebrow">MY ACCOUNT</span><h1>Welcome back</h1>
      <div className="account-layout">
        <aside className="account-menu">
          <div className="account-avatar">{initials}</div><strong>{name}</strong><small>{user.email}</small>
          <button className="filter-active">My Orders</button>
          {isAdmin && <button onClick={() => onNavigate('/admin')}>Admin</button>}
          <button onClick={async () => { await signOut(); onNavigate('/'); }}>Logout</button>
        </aside>
        <section className="orders">
          <div className="section-heading"><div><span className="eyebrow">ORDER HISTORY</span><h2>Your orders</h2><p>Your orders are saved to your account and stay available whenever you sign in.</p></div></div>
          {loading && <Loading label="Loading your orders…" />}
          {error && <ErrorMessage message={error} />}
          {!loading && !error && orders.length === 0 && (
            <div className="empty-state"><strong>No orders yet</strong><p>When you place an order it will appear here.</p><button className="primary-button" onClick={() => onNavigate('/products')}>Shop products →</button></div>
          )}
          {orders.map((order) => (
            <div key={order.id}>
              <div className="order-card">
                <div><strong>#{order.orderNumber}</strong><span>{formatDate(order.createdAt)} · {order.items.reduce((s, i) => s + i.quantity, 0)} items</span><span className={`pay-badge pay-${order.status === 'cancelled' ? 'cancelled' : order.paymentStatus}`}>{order.status === 'cancelled' ? 'Cancelled' : PAYMENT_LABEL[order.paymentStatus]}</span></div>
                <strong>{money(order.total)}</strong>
                <span className="order-status" style={{ textTransform: 'capitalize' }}>{order.status}</span>
                <button onClick={() => setOpenId(openId === order.id ? null : order.id)}>{openId === order.id ? 'Hide order' : 'View order'}</button>
              </div>
              {openId === order.id && (
                <div className="summary" style={{ marginTop: 8 }}>
                  {order.items.map((i) => <div key={i.id}><span>{i.productName} × {i.quantity}</span><strong>{money(i.unitPrice * i.quantity)}</strong></div>)}
                  <div><span>Delivery</span><strong>{order.deliveryFee > 0 ? money(order.deliveryFee) : DELIVERY_NOTE}</strong></div>
                  <div className="summary-total"><span>Total</span><strong>{money(order.total)}</strong></div>
                  {order.deliveredAt && <div><span>Delivered</span><strong>{formatDateTime(order.deliveredAt)}</strong></div>}
                  <div className="order-actions">
                    {order.paymentStatus === 'awaiting' && order.status !== 'cancelled' && <button className="primary-button" onClick={() => { onPay({ id: order.id, orderNumber: order.orderNumber, total: order.total }); onNavigate('/payment'); }}>Pay by bank transfer →</button>}
                    {order.paymentStatus === 'awaiting' && order.status !== 'cancelled' && <button className="outline-button" disabled={cancelling === order.id} onClick={() => handleCancel(order.id)}>{cancelling === order.id ? 'Cancelling…' : 'Cancel order'}</button>}
                    {order.paymentStatus !== 'awaiting' && <button className="outline-button" onClick={() => { onViewReceipt({ id: order.id, orderNumber: order.orderNumber, total: order.total }); onNavigate('/confirmation'); }}>View receipt</button>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      </div>
    </div></main>
  );
}
