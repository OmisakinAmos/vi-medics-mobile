/** Pure accounting maths for the admin Accounting tab. No React, no database: easy to test and reason about.
 *
 *  Rules (agreed with the owner):
 *  - A sale counts as revenue once the payment is CONFIRMED and the order is not cancelled.
 *  - Profit uses the cost price of each product (what the item cost to buy).
 *  - Delivery is arranged outside the app, so it is never part of revenue.
 *  - Profit = revenue - cost of goods - running costs (marketing and other).
 *    "Stock purchases" are NOT subtracted again from profit, because the cost of what was sold is already counted
 *    through cost prices. They are shown separately as money spent on stock (cash view).
 */

export type ExpenseCategory = 'stock' | 'marketing' | 'other';
export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: 'stock', label: 'Stock purchases' },
  { id: 'marketing', label: 'Marketing and ads' },
  { id: 'other', label: 'Other costs' },
];
export const categoryLabel = (c: ExpenseCategory) => EXPENSE_CATEGORIES.find((x) => x.id === c)?.label ?? c;

/** One product line of a counted sale. */
export type SaleLine = {
  orderId: string;
  orderNumber: string;
  soldAt: string; // ISO time the payment was confirmed
  state: string;
  city: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number; // 0 when the cost is not known yet
  costKnown: boolean;
};

export type Expense = {
  id: string;
  spentOn: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  vendor: string;
  amount: number;
};

// ------------------------------------------------------------------- periods
export type PresetId = 'today' | '7' | '30' | 'month' | 'lastMonth' | 'year' | 'all' | 'custom';
export const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7', label: 'Last 7 days' },
  { id: '30', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom dates' },
];

/** from is inclusive, to is exclusive. null means open-ended. */
export type Period = { from: Date | null; to: Date | null };

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Parses YYYY-MM-DD as a local date (not UTC), so a date stays on the day the owner typed. */
export function parseDay(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function makePeriod(preset: PresetId, customFrom: string, customTo: string, now: Date = new Date()): Period {
  const today = startOfDay(now);
  switch (preset) {
    case 'today': return { from: today, to: addDays(today, 1) };
    case '7': return { from: addDays(today, -6), to: addDays(today, 1) };
    case '30': return { from: addDays(today, -29), to: addDays(today, 1) };
    case 'month': return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    case 'lastMonth': return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
    case 'year': return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
    case 'custom': {
      const f = parseDay(customFrom);
      const t = parseDay(customTo);
      return { from: f, to: t ? addDays(t, 1) : null };
    }
    default: return { from: null, to: null };
  }
}

export const inPeriod = (d: Date, p: Period) => (!p.from || d >= p.from) && (!p.to || d < p.to);

const saleDate = (l: SaleLine) => new Date(l.soldAt);
const expenseDate = (e: Expense) => parseDay(e.spentOn) ?? new Date(0);

export const salesIn = (lines: SaleLine[], p: Period) => lines.filter((l) => inPeriod(saleDate(l), p));
export const expensesIn = (list: Expense[], p: Period) => list.filter((e) => inPeriod(expenseDate(e), p));

// ------------------------------------------------------------------ summary
export type Summary = {
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  marginPct: number; // gross margin, 0 when there is no revenue
  orders: number;
  units: number;
  stockSpend: number;
  marketing: number;
  other: number;
  runningCosts: number; // marketing + other
  netProfit: number;
  moneyOut: number; // every expense, including stock purchases
  cashNet: number; // revenue - moneyOut
  uncostedRevenue: number; // revenue from products with no cost price yet (profit is overstated for these)
};

export function summarize(lines: SaleLine[], expenses: Expense[], p: Period): Summary {
  const sales = salesIn(lines, p);
  const exp = expensesIn(expenses, p);
  const revenue = sales.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const costOfGoods = sales.reduce((s, l) => s + l.unitCost * l.quantity, 0);
  const sumCat = (c: ExpenseCategory) => exp.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0);
  const stockSpend = sumCat('stock');
  const marketing = sumCat('marketing');
  const other = sumCat('other');
  const grossProfit = revenue - costOfGoods;
  const runningCosts = marketing + other;
  return {
    revenue, costOfGoods, grossProfit,
    marginPct: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    orders: new Set(sales.map((l) => l.orderId)).size,
    units: sales.reduce((s, l) => s + l.quantity, 0),
    stockSpend, marketing, other, runningCosts,
    netProfit: grossProfit - runningCosts,
    moneyOut: stockSpend + marketing + other,
    cashNet: revenue - (stockSpend + marketing + other),
    uncostedRevenue: sales.filter((l) => !l.costKnown).reduce((s, l) => s + l.unitPrice * l.quantity, 0),
  };
}

// -------------------------------------------------------------------- trend
export type Granularity = 'day' | 'week' | 'month';
export type Bucket = { key: string; label: string; revenue: number; profit: number; expenses: number };

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function bucketStart(d: Date, g: Granularity): Date {
  if (g === 'day') return startOfDay(d);
  if (g === 'week') return mondayOf(d);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function nextBucket(d: Date, g: Granularity): Date {
  if (g === 'day') return addDays(d, 1);
  if (g === 'week') return addDays(d, 7);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function bucketLabel(d: Date, g: Granularity): string {
  if (g === 'month') return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Picks day, week or month buckets so the chart stays readable. */
export function pickGranularity(from: Date, to: Date): Granularity {
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
  if (days <= 35) return 'day';
  if (days <= 150) return 'week';
  return 'month';
}

export function trend(lines: SaleLine[], expenses: Expense[], p: Period, now: Date = new Date()): { buckets: Bucket[]; granularity: Granularity } {
  const sales = salesIn(lines, p);
  const exp = expensesIn(expenses, p);
  const dates = [...sales.map(saleDate), ...exp.map(expenseDate)];
  const earliest = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : now;
  const from = p.from ?? startOfDay(earliest);
  const to = p.to ?? addDays(startOfDay(now), 1);
  if (to <= from) return { buckets: [], granularity: 'day' };
  const granularity = pickGranularity(from, to);

  const map = new Map<string, Bucket>();
  const order: string[] = [];
  for (let d = bucketStart(from, granularity); d < to && order.length < 400; d = nextBucket(d, granularity)) {
    const key = dayKey(d);
    map.set(key, { key, label: bucketLabel(d, granularity), revenue: 0, profit: 0, expenses: 0 });
    order.push(key);
  }
  for (const l of sales) {
    const b = map.get(dayKey(bucketStart(saleDate(l), granularity)));
    if (b) { b.revenue += l.unitPrice * l.quantity; b.profit += (l.unitPrice - l.unitCost) * l.quantity; }
  }
  for (const e of exp) {
    const b = map.get(dayKey(bucketStart(expenseDate(e), granularity)));
    if (b) b.expenses += e.amount;
  }
  return { buckets: order.map((k) => map.get(k) as Bucket), granularity };
}

// ------------------------------------------------------------ products/places
export type ProductRow = { productId: string; name: string; units: number; revenue: number; cost: number; profit: number; marginPct: number; sharePct: number; costKnown: boolean };

export function byProduct(lines: SaleLine[], p: Period): ProductRow[] {
  const sales = salesIn(lines, p);
  const total = sales.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const map = new Map<string, ProductRow>();
  for (const l of sales) {
    const cur = map.get(l.productId) ?? { productId: l.productId, name: l.productName, units: 0, revenue: 0, cost: 0, profit: 0, marginPct: 0, sharePct: 0, costKnown: true };
    cur.units += l.quantity;
    cur.revenue += l.unitPrice * l.quantity;
    cur.cost += l.unitCost * l.quantity;
    cur.costKnown = cur.costKnown && l.costKnown;
    map.set(l.productId, cur);
  }
  return [...map.values()]
    .map((r) => {
      const profit = r.revenue - r.cost;
      return { ...r, profit, marginPct: r.revenue > 0 ? (profit / r.revenue) * 100 : 0, sharePct: total > 0 ? (r.revenue / total) * 100 : 0 };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

/** "  lagos STATE " -> "Lagos". Customers type places freely, so tidy them before grouping. */
export function normPlace(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ').replace(/\s+state$/i, '');
  if (!cleaned) return 'Unknown';
  if (/^[A-Za-z]{2,3}$/.test(cleaned) && cleaned === cleaned.toUpperCase()) return cleaned; // FCT, UK
  return cleaned.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export type PlaceRow = { place: string; orders: number; units: number; revenue: number; profit: number; sharePct: number; topProduct: string };

export function byLocation(lines: SaleLine[], p: Period, level: 'state' | 'city'): PlaceRow[] {
  const sales = salesIn(lines, p);
  const total = sales.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const acc = new Map<string, { orders: Set<string>; units: number; revenue: number; profit: number; products: Map<string, number> }>();
  for (const l of sales) {
    const place = level === 'state' ? normPlace(l.state) : `${normPlace(l.city)}, ${normPlace(l.state)}`;
    const cur = acc.get(place) ?? { orders: new Set<string>(), units: 0, revenue: 0, profit: 0, products: new Map<string, number>() };
    cur.orders.add(l.orderId);
    cur.units += l.quantity;
    cur.revenue += l.unitPrice * l.quantity;
    cur.profit += (l.unitPrice - l.unitCost) * l.quantity;
    cur.products.set(l.productName, (cur.products.get(l.productName) ?? 0) + l.quantity);
    acc.set(place, cur);
  }
  return [...acc.entries()]
    .map(([place, v]) => ({
      place, orders: v.orders.size, units: v.units, revenue: v.revenue, profit: v.profit,
      sharePct: total > 0 ? (v.revenue / total) * 100 : 0,
      topProduct: [...v.products.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export const pct = (n: number) => `${n.toFixed(n >= 10 || n === 0 ? 0 : 1)}%`;
