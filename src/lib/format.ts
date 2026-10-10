export const DELIVERY_FEE = 5000;

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
