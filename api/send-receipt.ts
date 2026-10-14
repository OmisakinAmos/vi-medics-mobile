// Vercel serverless function: emails the customer a branded receipt (through Mailgun) after they click "I have paid".
// The caller must send their Supabase access token; the order is read with that token,
// so row level security guarantees users can only trigger receipts for their own orders.

type OrderItem = { product_name: string; unit_price: number; quantity: number };
type Order = {
  order_number: number; created_at: string; paid_reported_at: string | null; payment_status: 'awaiting' | 'reported' | 'confirmed';
  customer_name: string; customer_email: string; customer_phone: string;
  address: string; city: string; state: string; country: string;
  subtotal: number; delivery_fee: number; total: number; order_items: OrderItem[];
};

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
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });

const PHONE = '+234 811 386 7495';

export async function POST(request: Request): Promise<Response> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const mailgunKey = process.env.MAILGUN_API_KEY;
  const mailgunDomain = process.env.MAILGUN_DOMAIN;
  const mailgunBase = process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net'; // use https://api.eu.mailgun.net for EU domains
  const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://vi-medics.vercel.app').replace(/\/$/, '');
  const notifyEmail = process.env.ORDER_NOTIFY_EMAIL; // optional: gets a copy of every receipt (BCC)

  if (!mailgunKey || !mailgunDomain) return json({ skipped: 'Mailgun is not configured' });
  if (!supabaseUrl || !anonKey) return json({ error: 'Supabase is not configured' }, 500);

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const { orderId } = (await request.json().catch(() => ({}))) as { orderId?: string };
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: 'Invalid order id' }, 400);

  const res = await fetch(
    `${supabaseUrl}/rest/v1/orders?id=eq.${orderId}&select=order_number,created_at,paid_reported_at,payment_status,customer_name,customer_email,customer_phone,address,city,state,country,subtotal,delivery_fee,total,order_items(product_name,unit_price,quantity)`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return json({ error: 'Could not load order' }, 401);
  const [order] = (await res.json()) as Order[];
  if (!order) return json({ error: 'Order not found' }, 404);
  if (order.payment_status === 'awaiting') return json({ error: 'Payment has not been reported for this order' }, 409);

  // The logo travels inside the email (inline attachment), because mail apps hide pictures loaded from the web
  // for new senders. If it cannot be fetched, fall back to the hosted logo.
  const logo = await fetch(`${siteUrl}/logo.png`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  const logoSrc = logo ? 'cid:logo.png' : `${siteUrl}/logo.png`;

  const ref = `VM-${order.order_number}`;
  const receiptNo = `RCT-${ref}`;
  const paidAt = when(order.paid_reported_at ?? order.created_at);
  const address = [order.address, order.city, order.state, order.country].filter(Boolean).join(', ');
  const statusLine =
    order.payment_status === 'confirmed'
      ? 'Payment confirmed'
      : 'Payment reported. Vi-Medics will confirm it once the transfer reflects in our account.';

  const text = [
    'VI-MEDICS - Medical Equipment, Supplies & Servicing',
    `${PHONE} | ${siteUrl}`,
    '',
    `PAYMENT RECEIPT ${receiptNo}`,
    `Order: #${ref}`,
    `Date: ${paidAt}`,
    'Payment method: Bank transfer',
    `Status: ${statusLine}`,
    '',
    `Customer: ${order.customer_name} (${order.customer_email}, ${order.customer_phone})`,
    `Delivery address: ${address}`,
    '',
    ...order.order_items.map((i) => `${i.product_name} | ${naira(i.unit_price)} x ${i.quantity} = ${naira(i.unit_price * i.quantity)}`),
    '',
    `Subtotal: ${naira(order.subtotal)}`,
    `Delivery: ${naira(order.delivery_fee)}`,
    `TOTAL: ${naira(order.total)}`,
    '',
    'Thank you for shopping with Vi-Medics.',
  ].join('\n');

  const td = 'padding:10px 0;border-bottom:1px solid #e5eef0;font-size:14px';
  const rows = order.order_items
    .map(
      (i) =>
        `<tr><td style="${td}">${esc(i.product_name)}<br><span style="color:#7b8794;font-size:12px">${naira(i.unit_price)} &times; ${i.quantity}</span></td><td style="${td};text-align:right;white-space:nowrap;vertical-align:top">${naira(i.unit_price * i.quantity)}</td></tr>`,
    )
    .join('');
  const meta = (label: string, value: string) =>
    `<tr><td style="padding:3px 0;color:#7b8794;font-size:13px;width:140px;vertical-align:top">${label}</td><td style="padding:3px 0;font-size:13px">${value}</td></tr>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f4f8f9;font-family:Arial,Helvetica,sans-serif;color:#102a43">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:22px 24px;border-bottom:4px solid #b86e3c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td><img src="${logoSrc}" alt="Vi-Medics" height="44" style="display:block;height:44px;width:auto;border:0"></td>
<td align="right" style="font-size:12px;color:#52606d;line-height:1.6"><strong style="color:#0f4c5c;font-size:14px">Vi-Medics</strong><br>Medical Equipment, Supplies &amp; Servicing<br>${PHONE}<br>${esc(siteUrl.replace(/^https?:\/\//, ''))}</td>
</tr></table></td></tr>
<tr><td style="padding:24px">
<h1 style="font-size:20px;margin:0 0 4px;color:#0f4c5c">Payment receipt</h1>
<p style="margin:0 0 18px;color:#52606d;font-size:14px;line-height:1.6">Hi ${esc(order.customer_name)}, thank you for your order. Here is your receipt.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f8f9;border-radius:10px;padding:12px 14px;margin-bottom:18px">
${meta('Receipt no.', `<strong>${receiptNo}</strong>`)}
${meta('Order', `<strong>#${ref}</strong>`)}
${meta('Date', esc(paidAt))}
${meta('Payment method', 'Bank transfer')}
${meta('Status', esc(statusLine))}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px">
<tr><td style="padding:0 0 6px;font-size:12px;color:#7b8794;text-transform:uppercase;letter-spacing:1px">Items purchased</td><td></td></tr>
${rows}
<tr><td style="padding:10px 0 4px;color:#52606d;font-size:14px">Subtotal</td><td style="padding:10px 0 4px;text-align:right;font-size:14px">${naira(order.subtotal)}</td></tr>
<tr><td style="padding:4px 0;color:#52606d;font-size:14px">Delivery</td><td style="padding:4px 0;text-align:right;font-size:14px">${naira(order.delivery_fee)}</td></tr>
<tr><td style="padding:12px 0;font-weight:bold;font-size:17px;border-top:2px solid #0f4c5c">Total</td><td style="padding:12px 0;text-align:right;font-weight:bold;font-size:17px;border-top:2px solid #0f4c5c">${naira(order.total)}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">
<tr><td style="padding:0 0 6px;font-size:12px;color:#7b8794;text-transform:uppercase;letter-spacing:1px">Delivery details</td></tr>
<tr><td style="font-size:14px;line-height:1.6">${esc(order.customer_name)}<br>${esc(address)}<br>${esc(order.customer_phone)}</td></tr>
</table>
<p style="margin:20px 0 0;color:#52606d;font-size:13px;line-height:1.6">You can follow this order any time by signing in to your Vi-Medics account and opening <em>My Orders</em>.</p>
</td></tr>
<tr><td style="background:#f4f8f9;color:#7b8794;padding:16px 24px;font-size:12px;line-height:1.6">Vi-Medics &mdash; Medical Equipment. Trusted Care.<br>You received this receipt because you placed an order at ${esc(siteUrl.replace(/^https?:\/\//, ''))}. Questions? Call ${PHONE}.</td></tr>
</table></td></tr></table></body></html>`;

  const form = new FormData();
  form.set('from', `Vi-Medics <orders@${mailgunDomain}>`);
  form.set('to', order.customer_email);
  form.set('subject', `Your Vi-Medics receipt - Order #${ref}`);
  form.set('text', text);
  form.set('html', html);
  if (notifyEmail) form.set('bcc', notifyEmail);
  if (logo) form.set('inline', new Blob([logo], { type: 'image/png' }), 'logo.png');
  const mg = await fetch(`${mailgunBase}/v3/${mailgunDomain}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`api:${mailgunKey}`)}` },
    body: form,
  });
  return mg.ok ? json({ sent: true }) : json({ error: 'Mailgun rejected the request', status: mg.status }, 502);
}
