/** Delivery is arranged and priced outside the app (distance and road conditions vary), so it is never added to totals. */
export const DELIVERY_NOTE = 'Arranged separately';

export const money = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

/** Client-side navigation using real URLs (/products, /product/vm-001) instead of #/ hashes. */
export function go(path: string) {
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });

export const PAYMENT_LABEL: Record<'awaiting' | 'reported' | 'confirmed', string> = {
  awaiting: 'Awaiting payment',
  reported: 'Payment reported',
  confirmed: 'Payment confirmed',
};
