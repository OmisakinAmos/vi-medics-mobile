import { supabase } from '../lib/supabase';
import type { CartItem, Order, OrderStatus, PaymentStatus } from '../types';

export type CustomerDetails = { name: string; email: string; phone: string; address: string; city: string; state: string; country: string };

export type PlacedOrder = { id: string; orderNumber: string; total: number };

type OrderRow = {
  id: string;
  order_number: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number | string;
  delivery_fee: number | string;
  total: number | string;
  created_at: string;
  paid_reported_at: string | null;
  delivered_at: string | null;
  customer_name: string; customer_email: string; customer_phone: string;
  address: string; city: string; state: string; country: string;
  order_items: { id: string; product_id: string; product_name: string; unit_price: number | string; quantity: number }[];
};

// In the web build the API is same-origin; in the Android app it must point at the deployed site.
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

const ORDER_SELECT =
  'id, order_number, status, payment_status, subtotal, delivery_fee, total, created_at, paid_reported_at, delivered_at, customer_name, customer_email, customer_phone, address, city, state, country, order_items(id, product_id, product_name, unit_price, quantity)';

const formatOrderNumber = (n: number) => `VM-${n}`;

const toOrder = (row: OrderRow): Order => ({
  id: row.id,
  orderNumber: formatOrderNumber(row.order_number),
  status: row.status,
  paymentStatus: row.payment_status,
  subtotal: Number(row.subtotal),
  deliveryFee: Number(row.delivery_fee),
  total: Number(row.total),
  createdAt: row.created_at,
  paidReportedAt: row.paid_reported_at,
  deliveredAt: row.delivered_at,
  customerName: row.customer_name,
  customerEmail: row.customer_email,
  customerPhone: row.customer_phone,
  address: row.address,
  city: row.city,
  state: row.state,
  country: row.country,
  items: row.order_items.map((i) => ({ id: i.id, productId: i.product_id, productName: i.product_name, unitPrice: Number(i.unit_price), quantity: i.quantity })),
});

/** Creates an order via the place_order() database function (validates stock, prices come from the DB). */
export async function placeOrder(cart: CartItem[], customer: CustomerDetails): Promise<PlacedOrder> {
  if (!supabase) throw new Error('Orders are not available because the database is not configured.');
  const items = cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity }));
  const { data: orderId, error } = await supabase.rpc('place_order', { p_items: items, p_customer: customer });
  if (error) throw new Error(error.message);
  const { data, error: readError } = await supabase.from('orders').select('id, order_number, total').eq('id', orderId as string).single();
  if (readError) throw new Error(readError.message);
  return { id: data.id as string, orderNumber: formatOrderNumber(data.order_number as number), total: Number(data.total) };
}

/** Lists the signed-in customer's orders (row level security restricts this to their own). */
export async function listMyOrders(): Promise<Order[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as OrderRow[]).map(toOrder);
}

/** Loads one of the signed-in customer's orders (row level security restricts this to their own). */
export async function getMyOrder(id: string): Promise<Order> {
  if (!supabase) throw new Error('The database is not configured.');
  const { data, error } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).single();
  if (error) throw new Error(error.message);
  return toOrder(data as unknown as OrderRow);
}

export type PaymentDetails = { bankName: string; accountName: string; accountNumber: string };

/** Bank details for transfers, set by the admin in Admin -> Payment settings. */
export async function getPaymentDetails(): Promise<PaymentDetails> {
  if (!supabase) throw new Error('The database is not configured.');
  const { data, error } = await supabase.from('store_settings').select('key, value').in('key', ['bank_name', 'account_name', 'account_number']);
  if (error) throw new Error(error.message);
  const map = new Map((data as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  return { bankName: map.get('bank_name') ?? '', accountName: map.get('account_name') ?? '', accountNumber: map.get('account_number') ?? '' };
}

/** "I have paid": records that the customer has made the transfer. The admin confirms it later. */
export async function reportPayment(orderId: string): Promise<void> {
  if (!supabase) throw new Error('The database is not configured.');
  const { error } = await supabase.rpc('report_payment', { p_order_id: orderId });
  if (error) throw new Error(error.message);
}

/** Cancels the customer's own unpaid order; the reserved stock goes back on the shelf. */
export async function cancelMyOrder(orderId: string): Promise<void> {
  if (!supabase) throw new Error('The database is not configured.');
  const { error } = await supabase.rpc('cancel_my_order', { p_order_id: orderId });
  if (error) throw new Error(error.message);
}

export type ReceiptResult = 'sent' | 'skipped' | 'failed';

/** Short technical reason for the last receipt email result (shown to help support). */
export let lastReceiptDetail = '';

/** Asks the server to email the payment receipt. Never throws: the result says whether the email went out. */
export async function requestReceiptEmail(orderId: string, accessToken: string): Promise<ReceiptResult> {
  try {
    const res = await fetch(`${API_BASE}/api/send-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ orderId }),
    });
    const body = (await res.json().catch(() => ({}))) as { sent?: boolean; skipped?: string; status?: number; detail?: string; error?: string };
    lastReceiptDetail = body.sent ? '' : [res.status, body.error ?? body.skipped, body.status, body.detail].filter(Boolean).join(' | ');
    if (body.sent) return 'sent';
    return body.skipped ? 'skipped' : 'failed';
  } catch (e) {
    lastReceiptDetail = `network: ${(e as Error).message}`;
    return 'failed';
  }
}
