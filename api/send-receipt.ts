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
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
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

  if (Number(request.headers.get('content-length') ?? 0) > 2048) return json({ error: 'Request too large' }, 413);
  const { orderId } = (await request.json().catch(() => ({}))) as { orderId?: string };
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: 'Invalid order id' }, 400);

  const res = await fetch(
    `${supabaseUrl}/rest/v1/orders?id=eq.${orderId}&select=order_number,created_at,paid_reported_at,payment_status,customer_name,customer_email,customer_phone,address,city,state,country,subtotal,delivery_fee,total,order_items(product_name,unit_price,quantity)`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return json({ error: 'Could not load order', detail: `orders ${res.status}` }, 401);
  const [order] = (await res.json()) as Order[];
  if (!order) return json({ error: 'Order not found' }, 404);
  if (order.payment_status === 'awaiting') return json({ error: 'Payment has not been reported for this order' }, 409);

  // Rate limit: the database allows one receipt per order every 2 minutes (stops email bombing and Mailgun quota abuse).
  const claim = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_receipt_send`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_order_id: orderId }),
  });
  // 404 = migration 007 not applied yet; keep receipts working until it is.
  if (claim.status !== 404) {
    const claimed = claim.ok ? await claim.json().catch(() => false) : false;
    if (claimed !== true) return json({ skipped: 'A receipt for this order was sent recently', detail: `claim ${claim.status} ${claimed}` });
  }

  // The logo travels inside the email (inline attachment), because mail apps hide pictures loaded from the web
  // for new senders. It is bundled with this function, so there is no network fetch that could fail.
  const logo = Uint8Array.from(atob(LOGO_PNG_BASE64), (c) => c.charCodeAt(0));
  const logoSrc = 'cid:vimedics-logo@vi-medics'; // must match the Content-ID header of the logo part in buildMime()

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
    `Delivery: ${order.delivery_fee > 0 ? naira(order.delivery_fee) : 'Arranged separately'}`,
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
<tr><td style="padding:4px 0;color:#52606d;font-size:14px">Delivery</td><td style="padding:4px 0;text-align:right;font-size:14px">${order.delivery_fee > 0 ? naira(order.delivery_fee) : 'Arranged separately'}</td></tr>
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

  // A hand-built MIME message gives full control of the logo's Content-ID, so the picture at the top of the email
  // is tied to the attached logo in every mail app (the simple "inline" form field left Gmail showing it at the bottom).
  const from = `Vi-Medics <orders@${mailgunDomain}>`;
  const subject = `Your Vi-Medics receipt - Order #${ref}`;
  const mime = buildMime({ from, to: order.customer_email, subject, text, html, logo });

  const form = new FormData();
  // Extra recipients that are not in the To header act as a hidden copy (BCC).
  form.set('to', notifyEmail ? `${order.customer_email},${notifyEmail}` : order.customer_email);
  form.set('message', new Blob([mime], { type: 'message/rfc822' }), 'message.mime');
  const mg = await fetch(`${mailgunBase}/v3/${mailgunDomain}/messages.mime`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`api:${mailgunKey}`)}` },
    body: form,
  });
  if (mg.ok) return json({ sent: true });
  const detail = (await mg.text().catch(() => '')).slice(0, 160);
  console.error('Mailgun rejected receipt', mg.status, detail);
  return json({ error: 'Mailgun rejected the request', status: mg.status, detail }, 502);
}

/** Base64 with 76-character lines, as email requires. */
function b64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/(.{76})/g, '$1\r\n');
}

/** Header values must be one line and free of line breaks (stops header injection). */
const clean = (v: string) => v.replace(/[\r\n]+/g, ' ').trim();

/** multipart/related( multipart/alternative( text, html ), inline logo ). */
function buildMime(m: { from: string; to: string; subject: string; text: string; html: string; logo: Uint8Array }): string {
  const enc = new TextEncoder();
  const rel = `rel_${crypto.randomUUID().replace(/-/g, '')}`;
  const alt = `alt_${crypto.randomUUID().replace(/-/g, '')}`;
  return [
    `From: ${clean(m.from)}`,
    `To: ${clean(m.to)}`,
    `Subject: ${clean(m.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/related; boundary="${rel}"; type="multipart/alternative"`,
    '',
    `--${rel}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(enc.encode(m.text)),
    `--${alt}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(enc.encode(m.html)),
    `--${alt}--`,
    '',
    `--${rel}`,
    'Content-Type: image/png; name="logo.png"',
    'Content-Transfer-Encoding: base64',
    'Content-ID: <vimedics-logo@vi-medics>',
    'Content-Disposition: inline; filename="logo.png"',
    '',
    b64(m.logo),
    `--${rel}--`,
    '',
  ].join('\r\n');
}

// Vi-Medics logo (330px wide, flattened on white), bundled in this file so the email can attach it inline.
const LOGO_PNG_BASE64 =
  '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';
