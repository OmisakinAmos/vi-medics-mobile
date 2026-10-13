import { useEffect, useMemo, useState } from 'react';
import { ErrorMessage, Loading } from '../../components/StatusMessage';
import { PAYMENT_LABEL, formatDateTime, money } from '../../lib/format';
import { ORDER_STATUSES, adminConfirmPayment, adminListOrders, adminUpdateOrderStatus, type AdminOrder } from '../../services/adminService';
import type { OrderStatus } from '../../types';

export function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setBusy(null);
    adminListOrders()
      .then((o) => { setOrders(o); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const shown = useMemo(
    () => orders.filter((o) => (filter === 'all' || o.status === filter) && `${o.orderNumber} ${o.customerName} ${o.customerEmail} ${o.customerPhone}`.toLowerCase().includes(query.toLowerCase())),
    [orders, filter, query],
  );

  const setStatus = async (id: string, status: OrderStatus) => {
    if (status === 'cancelled' && !window.confirm('Cancel this order? The reserved stock goes back on the shelf and a cancelled order cannot be reopened.')) return;
    setBusy(id);
    try { await adminUpdateOrderStatus(id, status); load(); }
    catch (e) { setError((e as Error).message); setBusy(null); }
  };

  const confirmPayment = async (o: AdminOrder) => {
    if (!window.confirm(`Confirm that ${money(o.total)} for order ${o.orderNumber} has reached the bank account?`)) return;
    setBusy(o.id);
    try { await adminConfirmPayment(o.id, o.status); load(); }
    catch (e) { setError((e as Error).message); setBusy(null); }
  };

  const markDelivered = async (o: AdminOrder) => {
    if (o.paymentStatus !== 'confirmed' && !window.confirm('Payment for this order is not confirmed yet. Mark it as delivered anyway?')) return;
    await setStatus(o.id, 'delivered');
  };

  return (
    <section>
      <div className="admin-toolbar">
        <div className="search-field"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search order number, name, email or phone…" /></div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | OrderStatus)}>
          <option value="all">All statuses</option>
          {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {loading && <Loading label="Loading orders…" />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && shown.length === 0 && <div className="empty-state"><strong>No orders found</strong></div>}
      <div className="admin-list">
        {shown.map((o) => (
          <div key={o.id} className="admin-order">
            <div className="admin-row">
              <div className="admin-row-main">
                <strong>#{o.orderNumber} · {money(o.total)}</strong>
                <span>{o.customerName} · {formatDateTime(o.createdAt)}</span>
                <span><i className={`pay-badge pay-${o.status === 'cancelled' ? 'cancelled' : o.paymentStatus}`}>{o.status === 'cancelled' ? 'Cancelled' : PAYMENT_LABEL[o.paymentStatus]}</i>{o.deliveredAt && <> · Delivered {formatDateTime(o.deliveredAt)}</>}</span>
              </div>
              <select aria-label={`Status of order ${o.orderNumber}`} value={o.status} disabled={busy === o.id} onChange={(e) => setStatus(o.id, e.target.value as OrderStatus)}>
                {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              {o.status !== 'cancelled' && o.paymentStatus !== 'confirmed' && <button className="outline-button" disabled={busy === o.id} onClick={() => confirmPayment(o)}>Confirm payment</button>}
              {o.status !== 'cancelled' && o.status !== 'delivered' && <button className="primary-button admin-deliver" disabled={busy === o.id} onClick={() => markDelivered(o)}>Mark delivered</button>}
              <button className="outline-button" onClick={() => setOpenId(openId === o.id ? null : o.id)}>{openId === o.id ? 'Hide' : 'Details'}</button>
            </div>
            {openId === o.id && (
              <div className="admin-details">
                <p><strong>Customer:</strong> {o.customerName}<br /><a href={`mailto:${o.customerEmail}`}>{o.customerEmail}</a> · <a href={`tel:${o.customerPhone}`}>{o.customerPhone}</a></p>
                <p><strong>Payment:</strong> Bank transfer · {PAYMENT_LABEL[o.paymentStatus]}{o.paidReportedAt && <> · reported {formatDateTime(o.paidReportedAt)}</>}{o.paymentConfirmedAt && <> · confirmed {formatDateTime(o.paymentConfirmedAt)}</>}</p>
                <p><strong>Deliver to:</strong> {o.address}, {o.city}, {o.state}</p>
                <div className="summary">
                  {o.items.map((i) => <div key={i.id}><span>{i.productName} × {i.quantity}</span><strong>{money(i.unitPrice * i.quantity)}</strong></div>)}
                  <div className="summary-total"><span>Total (incl. delivery)</span><strong>{money(o.total)}</strong></div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
