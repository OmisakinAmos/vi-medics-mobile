// Vercel serverless function: sends an order confirmation email through Mailgun.
// The caller must send their Supabase access token; the order is read with that token,
// so row level security guarantees users can only trigger emails for their own orders.

type OrderItem = { product_name: string; unit_price: number; quantity: number };
type Order = { order_number: number; customer_name: string; customer_email: string; total: number; delivery_fee: number; order_items: OrderItem[] };

// The Android app (served from https://localhost inside the WebView) calls this endpoint cross-origin.
// Safe to allow any origin: access is controlled by the bearer token, not by cookies.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: cors });
}

const esc = (v: string) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const naira = (n: number) => `NGN ${Number(n).toLocaleString('en-NG')}`;

export async function POST(request: Request): Promise<Response> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const mailgunKey = process.env.MAILGUN_API_KEY;
  const mailgunDomain = process.env.MAILGUN_DOMAIN;
  const mailgunBase = process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net'; // use https://api.eu.mailgun.net for EU domains

  if (!mailgunKey || !mailgunDomain) return json({ skipped: 'Mailgun is not configured' });
  if (!supabaseUrl || !anonKey) return json({ error: 'Supabase is not configured' }, 500);

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const { orderId } = (await request.json().catch(() => ({}))) as { orderId?: string };
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: 'Invalid order id' }, 400);

  const res = await fetch(
    `${supabaseUrl}/rest/v1/orders?id=eq.${orderId}&select=order_number,customer_name,customer_email,total,delivery_fee,order_items(product_name,unit_price,quantity)`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return json({ error: 'Could not load order' }, 401);
  const [order] = (await res.json()) as Order[];
  if (!order) return json({ error: 'Order not found' }, 404);

  const lines = order.order_items.map((i) => `${i.product_name} x ${i.quantity} — ${naira(i.unit_price * i.quantity)}`);
  const text = [
    `Hi ${order.customer_name},`,
    '',
    `Thank you for your order #VM-${order.order_number} with Vi-Medics.`,
    '',
    ...lines,
    `Delivery — ${naira(order.delivery_fee)}`,
    `Total — ${naira(order.total)}`,
    '',
    'You can view your orders any time by signing in to your account.',
    '',
    'Vi-Medics — Medical Equipment. Trusted Care.',
  ].join('\n');

  const rows = order.order_items
    .map(
      (i) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid #e5eef0">${esc(i.product_name)} &times; ${i.quantity}</td><td style="padding:10px 0;border-bottom:1px solid #e5eef0;text-align:right;white-space:nowrap">${naira(i.unit_price * i.quantity)}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><body style="margin:0;background:#f4f8f9;font-family:Arial,Helvetica,sans-serif;color:#102a43">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#0f4c5c;color:#ffffff;padding:20px 24px;font-size:18px;font-weight:bold;letter-spacing:1px">VI-MEDICS</td></tr>
<tr><td style="padding:24px">
<h1 style="font-size:20px;margin:0 0 8px">Thank you for your order, ${esc(order.customer_name)}.</h1>
<p style="margin:0 0 18px;color:#52606d;font-size:14px;line-height:1.6">We have received your order <strong>#VM-${order.order_number}</strong>. Here is a summary:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
${rows}
<tr><td style="padding:10px 0;color:#52606d">Delivery</td><td style="padding:10px 0;text-align:right">${naira(order.delivery_fee)}</td></tr>
<tr><td style="padding:12px 0;font-weight:bold;font-size:16px">Total</td><td style="padding:12px 0;text-align:right;font-weight:bold;font-size:16px">${naira(order.total)}</td></tr>
</table>
<p style="margin:20px 0 0;color:#52606d;font-size:13px;line-height:1.6">You can view this order any time by signing in to your Vi-Medics account and opening <em>My Orders</em>.</p>
</td></tr>
<tr><td style="background:#f4f8f9;color:#7b8794;padding:16px 24px;font-size:12px;line-height:1.6">Vi-Medics &mdash; Medical Equipment. Trusted Care.<br>You received this email because you placed an order at vi-medics.vercel.app. Questions? Call +234 811 386 7495.</td></tr>
</table></td></tr></table></body></html>`;

  const form = new URLSearchParams({
    from: `Vi-Medics <orders@${mailgunDomain}>`,
    to: order.customer_email,
    subject: `Your Vi-Medics order #VM-${order.order_number}`,
    text,
    html,
    'h:Reply-To': 'help@vi-medics.example',
  });
  const mg = await fetch(`${mailgunBase}/v3/${mailgunDomain}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`api:${mailgunKey}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  return mg.ok ? json({ sent: true }) : json({ error: 'Mailgun rejected the request', status: mg.status }, 502);
}
