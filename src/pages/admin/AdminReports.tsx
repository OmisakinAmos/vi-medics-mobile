import { useEffect, useMemo, useState } from 'react';
import { ErrorMessage, Loading } from '../../components/StatusMessage';
import { downloadCsv } from '../../lib/csv';
import { PAYMENT_LABEL, formatDateTime, money } from '../../lib/format';
import { ORDER_STATUSES, adminListCustomers, adminListOrders, adminListProducts, type AdminCustomer, type AdminOrder, type AdminProduct } from '../../services/adminService';

type Range = 'today' | '7' | '30' | 'month' | 'all';
const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
];
const LOW_STOCK = 5;

function rangeStart(range: Range): number {
  const now = new Date();
  if (range === 'all') return 0;
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return now.getTime() - Number(range) * 86400000;
}

function Bars({ rows, format = (n: number) => String(n) }: { rows: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="report-bars">
      {rows.map((r) => (
        <div key={r.label} className="report-bar-row">
          <span className="report-bar-label">{r.label}</span>
          <span className="report-bar-track"><span className="report-bar-fill" style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <strong>{format(r.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export function AdminReports() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('30');

  useEffect(() => {
    Promise.all([adminListOrders(), adminListProducts(), adminListCustomers()])
      .then(([o, p, c]) => { setOrders(o); setProducts(p); setCustomers(c); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const report = useMemo(() => {
    const start = rangeStart(range);
    const inRange = orders.filter((o) => new Date(o.createdAt).getTime() >= start);
    const live = inRange.filter((o) => o.status !== 'cancelled');
    const sum = (list: AdminOrder[]) => list.reduce((s, o) => s + o.total, 0);
    const received = live.filter((o) => o.paymentStatus === 'confirmed');
    const unpaid = live.filter((o) => o.paymentStatus !== 'confirmed');
    const delivered = inRange.filter((o) => o.status === 'delivered');

    const byProduct = new Map<string, { qty: number; revenue: number }>();
    for (const o of live) for (const i of o.items) {
      const cur = byProduct.get(i.productName) ?? { qty: 0, revenue: 0 };
      byProduct.set(i.productName, { qty: cur.qty + i.quantity, revenue: cur.revenue + i.unitPrice * i.quantity });
    }
    const top = [...byProduct.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    return {
      inRange, live, received, unpaid, delivered, top,
      receivedTotal: sum(received), unpaidTotal: sum(unpaid), deliveredTotal: sum(delivered),
      avg: live.length ? sum(live) / live.length : 0,
      byStatus: ORDER_STATUSES.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: inRange.filter((o) => o.status === s).length })),
      byPayment: (['awaiting', 'reported', 'confirmed'] as const).map((s) => ({ label: PAYMENT_LABEL[s], value: live.filter((o) => o.paymentStatus === s).length })),
      newCustomers: customers.filter((c) => new Date(c.joined).getTime() >= start).length,
    };
  }, [orders, customers, range]);

  const stock = useMemo(() => {
    const active = products.filter((p) => p.status === 'active');
    return { out: active.filter((p) => p.stockQuantity <= 0), low: active.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= LOW_STOCK) };
  }, [products]);

  const exportOrders = () => {
    downloadCsv(`vi-medics-orders-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Order', 'Date', 'Customer', 'Email', 'Phone', 'Address', 'Items', 'Order status', 'Payment status', 'Total (NGN)', 'Delivered at'],
      ...report.inRange.map((o) => [
        o.orderNumber, formatDateTime(o.createdAt), o.customerName, o.customerEmail, o.customerPhone, `${o.address}, ${o.city}, ${o.state}`,
        o.items.map((i) => `${i.productName} x${i.quantity}`).join('; '), o.status, PAYMENT_LABEL[o.paymentStatus], o.total, o.deliveredAt ? formatDateTime(o.deliveredAt) : '',
      ]),
    ]);
  };

  if (loading) return <Loading label="Building reports…" />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <section className="reports">
      <div className="admin-toolbar">
        <select value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Report period">
          {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <button className="outline-button" onClick={exportOrders} disabled={report.inRange.length === 0}>Download orders (CSV)</button>
      </div>

      <div className="report-kpis">
        <div className="report-kpi"><span>Orders placed</span><strong>{report.inRange.length}</strong><small>{report.inRange.length - report.live.length} cancelled</small></div>
        <div className="report-kpi"><span>Money received</span><strong>{money(report.receivedTotal)}</strong><small>{report.received.length} confirmed payments</small></div>
        <div className="report-kpi"><span>Awaiting payment</span><strong>{money(report.unpaidTotal)}</strong><small>{report.unpaid.length} orders not yet confirmed</small></div>
        <div className="report-kpi"><span>Delivered</span><strong>{report.delivered.length}</strong><small>{money(report.deliveredTotal)}</small></div>
        <div className="report-kpi"><span>Average order</span><strong>{money(Math.round(report.avg))}</strong><small>excluding cancelled</small></div>
        <div className="report-kpi"><span>New customers</span><strong>{report.newCustomers}</strong><small>{customers.length} in total</small></div>
      </div>

      <div className="report-grid">
        <div className="form-card"><h2>Orders by status</h2><Bars rows={report.byStatus} /></div>
        <div className="form-card"><h2>Payments</h2><Bars rows={report.byPayment} /><p className="admin-hint">Counts exclude cancelled orders.</p></div>
        <div className="form-card">
          <h2>Best-selling products</h2>
          {report.top.length === 0 ? <p className="admin-hint">No sales in this period.</p> : <Bars rows={report.top.map((t) => ({ label: `${t.name} (${t.qty})`, value: t.revenue }))} format={money} />}
        </div>
        <div className="form-card">
          <h2>Stock to watch</h2>
          {stock.out.length === 0 && stock.low.length === 0 && <p className="admin-hint">All active products are well stocked.</p>}
          {stock.out.map((p) => <div key={p.id} className="report-stock"><span>{p.name}</span><i className="pay-badge pay-cancelled">Out of stock</i></div>)}
          {stock.low.map((p) => <div key={p.id} className="report-stock"><span>{p.name}</span><i className="pay-badge pay-awaiting">{p.stockQuantity} left</i></div>)}
          <p className="admin-hint">Low stock means {LOW_STOCK} or fewer.</p>
        </div>
      </div>
    </section>
  );
}
