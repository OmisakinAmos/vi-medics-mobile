import type { Navigate } from '../types';

type Props = { route: string; cartCount: number; signedIn: boolean; onNavigate: Navigate };

/** Thumb-friendly tab bar shown on phones and in the Android app (hidden on larger screens via CSS). */
export function BottomNav({ route, cartCount, signedIn, onNavigate }: Props) {
  const tabs = [
    { path: '/', label: 'Home', icon: '⌂', active: route === '/' },
    { path: '/products', label: 'Shop', icon: '▦', active: route.startsWith('/product') },
    { path: '/cart', label: 'Cart', icon: '🛒', active: route === '/cart' || route === '/checkout' },
    { path: signedIn ? '/account' : '/login', label: signedIn ? 'Account' : 'Sign in', icon: '◯', active: route === '/account' || route === '/login' },
  ];
  return (
    <nav className="bottom-nav" aria-label="Main">
      {tabs.map((t) => (
        <button key={t.label} className={t.active ? 'bottom-nav-active' : ''} onClick={() => onNavigate(t.path)} aria-current={t.active ? 'page' : undefined}>
          <span className="bottom-nav-icon">
            {t.icon}
            {t.label === 'Cart' && cartCount > 0 && <b>{cartCount}</b>}
          </span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
