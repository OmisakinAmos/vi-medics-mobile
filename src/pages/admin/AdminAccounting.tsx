import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Bars } from '../../components/Bars';
import { ErrorMessage, Loading } from '../../components/StatusMessage';
import {
  EXPENSE_CATEGORIES, PRESETS, byLocation, byProduct, categoryLabel, expensesIn, makePeriod, pct, summarize, trend,
  type Expense, type ExpenseCategory, type PresetId, type SaleLine,
} from '../../lib/accounting';
import { downloadCsv } from '../../lib/csv';
import { money } from '../../lib/format';
import { adminAddExpense, adminDeleteExpense, adminListExpenses, adminListSalesLines } from '../../services/accountingService';

type Sub = 'overview' | 'products' | 'locations' | 'expenses';
const SUBS: { id: Sub; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products' },
  { id: 'locations', label: 'Locations' },
  { id: 'expenses', label: 'Expenses' },
];

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the viewer's own time zone
const stamp = () => new Date().toISOString().slice(0, 10);

/** Revenue and expense bars for each day, week or month. */
function TrendChart({ buckets }: { buckets: { key: string; label: string; revenue: number; expenses: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.revenue, b.expenses)));
  // With many buckets only some labels are shown, so they do not overlap.
  const every = Math.max(1, Math.ceil(buckets.length / 8));
  return (
    <div className="acc-chart-scroll">
      <div className="acc-chart" style={{ minWidth: Math.min(buckets.length * 22, 900) }} role="img" aria-label="Revenue and expenses over time">
        {buckets.map((b, i) => (
          <div key={b.key} className="acc-col" title={`${b.label}: sales ${money(b.revenue)}, expenses ${money(b.expenses)}`}>
            <div className="acc-bars">
              <span className="acc-bar acc-bar-rev" style={{ height: `${(b.revenue / max) * 100}%` }} />
              <span className="acc-bar acc-bar-exp" style={{ height: `${(b.expenses / max) * 100}%` }} />
            </div>
            <span className="acc-col-label">{i % every === 0 ? b.label : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminAccounting() {
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<Sub>('overview');
  const [preset, setPreset] = useState<PresetId>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [level, setLevel] = useState<'state' | 'city'>('state');

  const load = () =>
    Promise.all([adminListSalesLines(), adminListExpenses()])
      .then(([l, e]) => { setLines(l); setExpenses(e); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => { void load(); }, []);

  const period = useMemo(() => makePeriod(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const sum = useMemo(() => summarize(lines, expenses, period), [lines, expenses, period]);
  const chart = useMemo(() => trend(lines, expenses, period), [lines, expenses, period]);
  const products = useMemo(() => byProduct(lines, period), [lines, period]);
  const places = useMemo(() => byLocation(lines, period, level), [lines, period, level]);
  const periodExpenses = useMemo(() => expensesIn(expenses, period), [expenses, period]);

  if (loading) return <Loading label="Opening the books…" />;
  if (error) {
    const missing = /product_costs|order_item_costs|expenses|schema cache|does not exist/i.test(error);
    return (
      <div>
        <ErrorMessage message={error} />
        {missing && <p className="admin-hint">The accounting tables are not set up yet. Run <strong>008-accounting.sql</strong> once in the Supabase SQL Editor, then reload this page.</p>}
      </div>
    );
  }

  const exportOverview = () =>
    downloadCsv(`vi-medics-summary-${stamp()}.csv`, [
      ['Item', 'Amount (NGN)'],
      ['Sales (confirmed payments)', sum.revenue],
      ['Cost of goods sold', sum.costOfGoods],
      ['Gross profit', sum.grossProfit],
      ['Marketing and ads', sum.marketing],
      ['Other costs', sum.other],
      ['Net profit', sum.netProfit],
      ['Money spent on stock', sum.stockSpend],
      ['Net cash movement (sales - all expenses)', sum.cashNet],
      [],
      ['Period', 'Sales', 'Profit', 'Expenses'],
      ...chart.buckets.map((b) => [b.label, b.revenue, b.profit, b.expenses]),
    ]);

  const exportProducts = () =>
    downloadCsv(`vi-medics-products-${stamp()}.csv`, [
      ['Product', 'Units sold', 'Sales (NGN)', 'Cost (NGN)', 'Profit (NGN)', 'Margin %', 'Share of sales %', 'Cost price known'],
      ...products.map((r) => [r.name, r.units, r.revenue, r.cost, r.profit, r.marginPct.toFixed(1), r.sharePct.toFixed(1), r.costKnown ? 'yes' : 'no']),
    ]);

  const exportPlaces = () =>
    downloadCsv(`vi-medics-${level === 'state' ? 'states' : 'cities'}-${stamp()}.csv`, [
      [level === 'state' ? 'State' : 'City', 'Orders', 'Units', 'Sales (NGN)', 'Profit (NGN)', 'Share of sales %', 'Top product'],
      ...places.map((r) => [r.place, r.orders, r.units, r.revenue, r.profit, r.sharePct.toFixed(1), r.topProduct]),
    ]);

  const exportExpenses = () =>
    downloadCsv(`vi-medics-expenses-${stamp()}.csv`, [
      ['Date', 'Category', 'Description', 'Vendor', 'Amount (NGN)'],
      ...periodExpenses.map((e) => [e.spentOn, categoryLabel(e.category), e.description, e.vendor, e.amount]),
    ]);

  const onDelete = async (e: Expense) => {
    if (!window.confirm(`Delete this expense?\n${e.description} (${money(e.amount)})\nThis is recorded in the audit trail.`)) return;
    try { await adminDeleteExpense(e.id); await load(); }
    catch (err) { setError((err as Error).message); }
  };

  return (
    <section className="reports">
      <div className="acc-subtabs" role="tablist">
        {SUBS.map((s) => <button key={s.id} role="tab" aria-selected={sub === s.id} className={sub === s.id ? 'acc-subtab acc-subtab-active' : 'acc-subtab'} onClick={() => setSub(s.id)}>{s.label}</button>)}
      </div>

      <div className="admin-toolbar">
        <select value={preset} onChange={(e) => setPreset(e.target.value as PresetId)} aria-label="Period">
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {preset === 'custom' && (
          <>
            <input type="date" className="admin-date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} aria-label="From date" />
            <input type="date" className="admin-date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} aria-label="To date" />
          </>
        )}
        {sub === 'overview' && <button className="outline-button" onClick={exportOverview}>Download summary (CSV)</button>}
        {sub === 'products' && <button className="outline-button" onClick={exportProducts} disabled={products.length === 0}>Download (CSV)</button>}
        {sub === 'locations' && <button className="outline-button" onClick={exportPlaces} disabled={places.length === 0}>Download (CSV)</button>}
        {sub === 'expenses' && <button className="outline-button" onClick={exportExpenses} disabled={periodExpenses.length === 0}>Download (CSV)</button>}
      </div>

      {sub === 'overview' && (
        <>
          <p className="admin-hint" style={{ marginTop: 0 }}>Sales count once a payment is <strong>confirmed</strong> (cancelled orders never count). Delivery is handled outside the app, so it is not part of sales.</p>
          <div className="report-kpis">
            <div className="report-kpi"><span>Sales</span><strong>{money(sum.revenue)}</strong><small>{sum.orders} orders · {sum.units} items</small></div>
            <div className="report-kpi"><span>Cost of goods sold</span><strong>{money(sum.costOfGoods)}</strong><small>from product cost prices</small></div>
            <div className="report-kpi"><span>Gross profit</span><strong>{money(sum.grossProfit)}</strong><small>{pct(sum.marginPct)} margin</small></div>
            <div className="report-kpi"><span>Marketing and other costs</span><strong>{money(sum.runningCosts)}</strong><small>{money(sum.marketing)} marketing · {money(sum.other)} other</small></div>
            <div className="report-kpi acc-kpi-main"><span>Net profit</span><strong className={sum.netProfit < 0 ? 'acc-neg' : ''}>{money(sum.netProfit)}</strong><small>gross profit minus those costs</small></div>
            <div className="report-kpi"><span>Spent on stock</span><strong>{money(sum.stockSpend)}</strong><small>buying stock, shown separately</small></div>
          </div>
          {sum.uncostedRevenue > 0 && (
            <div className="checkout-note">{money(sum.uncostedRevenue)} of these sales are for products with no cost price yet, so profit looks higher than it really is. Add the cost price when you edit each product.</div>
          )}
          <div className="report-grid" style={{ marginTop: 14 }}>
            <div className="form-card acc-wide">
              <h2>Sales and expenses over time</h2>
              <div className="acc-legend"><span><i className="acc-dot acc-dot-rev" />Sales</span><span><i className="acc-dot acc-dot-exp" />Expenses</span><span className="admin-hint">by {chart.granularity}</span></div>
              {chart.buckets.length === 0 || (sum.revenue === 0 && sum.moneyOut === 0)
                ? <p className="admin-hint">Nothing recorded in this period yet.</p>
                : <TrendChart buckets={chart.buckets} />}
            </div>
            <div className="form-card">
              <h2>Money in and out</h2>
              <div className="acc-rows">
                <div><span>Money in (sales)</span><strong>{money(sum.revenue)}</strong></div>
                <div><span>Stock purchases</span><strong>{money(sum.stockSpend)}</strong></div>
                <div><span>Marketing and ads</span><strong>{money(sum.marketing)}</strong></div>
                <div><span>Other costs</span><strong>{money(sum.other)}</strong></div>
                <div className="acc-rows-total"><span>Net cash movement</span><strong className={sum.cashNet < 0 ? 'acc-neg' : ''}>{money(sum.cashNet)}</strong></div>
              </div>
              <p className="admin-hint">Cash view: what came in minus everything spent, including stock you bought. It can differ from profit when you stock up ahead of sales.</p>
            </div>
            <div className="form-card">
              <h2>Where the money went</h2>
              {sum.moneyOut === 0 ? <p className="admin-hint">No expenses recorded in this period.</p> : (
                <Bars format={money} rows={[
                  { label: 'Stock purchases', value: sum.stockSpend },
                  { label: 'Marketing and ads', value: sum.marketing },
                  { label: 'Other costs', value: sum.other },
                ]} />
              )}
            </div>
          </div>
        </>
      )}

      {sub === 'products' && (
        <div className="form-card">
          <h2>Sales and profit by product</h2>
          {products.length === 0 ? <p className="admin-hint">No confirmed sales in this period.</p> : (
            <>
              <Bars format={money} rows={products.slice(0, 8).map((r) => ({ label: `${r.name} (${r.units})`, value: r.revenue }))} />
              <div className="acc-table-wrap">
                <table className="acc-table">
                  <thead><tr><th>Product</th><th>Units</th><th>Sales</th><th>Profit</th><th>Margin</th><th>Share</th></tr></thead>
                  <tbody>
                    {products.map((r) => (
                      <tr key={r.productId}>
                        <td>{r.name}{!r.costKnown && <em className="acc-flag" title="No cost price set, so profit may be overstated"> no cost</em>}</td>
                        <td>{r.units}</td><td>{money(r.revenue)}</td><td className={r.profit < 0 ? 'acc-neg' : ''}>{money(r.profit)}</td><td>{pct(r.marginPct)}</td><td>{pct(r.sharePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {sub === 'locations' && (
        <div className="form-card">
          <div className="acc-level">
            <h2 style={{ margin: 0 }}>Where your customers are</h2>
            <div className="acc-subtabs">
              <button className={level === 'state' ? 'acc-subtab acc-subtab-active' : 'acc-subtab'} onClick={() => setLevel('state')}>By state</button>
              <button className={level === 'city' ? 'acc-subtab acc-subtab-active' : 'acc-subtab'} onClick={() => setLevel('city')}>By city</button>
            </div>
          </div>
          {places.length === 0 ? <p className="admin-hint">No confirmed sales in this period.</p> : (
            <>
              <Bars format={money} rows={places.slice(0, 8).map((r) => ({ label: r.place, value: r.revenue }))} />
              <div className="acc-table-wrap">
                <table className="acc-table">
                  <thead><tr><th>{level === 'state' ? 'State' : 'City'}</th><th>Orders</th><th>Sales</th><th>Profit</th><th>Share</th><th>Top product</th></tr></thead>
                  <tbody>
                    {places.map((r) => (
                      <tr key={r.place}><td>{r.place}</td><td>{r.orders}</td><td>{money(r.revenue)}</td><td className={r.profit < 0 ? 'acc-neg' : ''}>{money(r.profit)}</td><td>{pct(r.sharePct)}</td><td>{r.topProduct}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {sub === 'expenses' && (
        <>
          <ExpenseForm onAdded={load} />
          <div className="form-card">
            <h2>Expenses in this period · {money(periodExpenses.reduce((s, e) => s + e.amount, 0))}</h2>
            {periodExpenses.length === 0 ? <p className="admin-hint">No expenses recorded in this period. Add one above.</p> : (
              <div className="admin-list">
                {periodExpenses.map((e) => (
                  <div key={e.id} className="admin-row acc-expense">
                    <div>
                      <strong>{e.description}</strong>
                      <span>{e.spentOn} · {categoryLabel(e.category)}{e.vendor ? ` · ${e.vendor}` : ''}</span>
                    </div>
                    <strong>{money(e.amount)}</strong>
                    <button className="outline-button" onClick={() => void onDelete(e)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ExpenseForm({ onAdded }: { onAdded: () => Promise<void> | void }) {
  const [spentOn, setSpentOn] = useState(today());
  const [category, setCategory] = useState<ExpenseCategory>('stock');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const amountNum = Number(amount.replace(/,/g, ''));
    if (description.trim().length < 2) return setError('Describe the expense (at least 2 characters).');
    if (!Number.isFinite(amountNum) || amountNum <= 0) return setError('Enter an amount greater than zero.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) return setError('Pick the date of the expense.');
    setSaving(true); setError(null); setNotice(null);
    try {
      await adminAddExpense({ spentOn, category, description, vendor, amount: amountNum });
      setDescription(''); setVendor(''); setAmount('');
      setNotice('Expense saved.');
      await onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <form className="checkout-form admin-form" onSubmit={submit}>
      <div className="form-card">
        <h2>Record an expense</h2>
        <div className="form-grid">
          <label>Date<input type="date" required value={spentOn} max={today()} onChange={(e) => setSpentOn(e.target.value)} /></label>
          <label>Category
            <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="full">What was it for?<input required maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. 20 pulse oximeters from supplier" /></label>
          <label>Paid to (optional)<input maxLength={100} value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Supplier or platform" /></label>
          <label>Amount (₦)<input required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></label>
        </div>
        {error && <ErrorMessage message={error} />}
        {notice && <p className="admin-hint" role="status">{notice}</p>}
        <button className="primary-button" type="submit" disabled={saving} style={{ marginTop: 14 }}>{saving ? 'Saving…' : 'Save expense'}</button>
        <p className="admin-hint">Every expense you add or delete is recorded in the audit trail.</p>
      </div>
    </form>
  );
}
