import { Link } from './Link';

type Props = { route: string; signedIn: boolean; cartCount: number };

/** Logo followed by the main navigation bar: Home, Shop, Servicing, (About), Cart, Account. */
export function Header({ route, signedIn, cartCount }: Props) {
  const items = [
    { to: '/', label: 'Home', icon: '⌂', active: route === '/', cls: '' },
    { to: '/products', label: 'Shop', icon: '▦', active: route.startsWith('/product'), cls: '' },
    { to: '/services', label: 'Servicing', icon: '🔧', active: route === '/services', cls: '' },
    { to: '/about', label: 'About', icon: 'ⓘ', active: route === '/about', cls: 'nav-about' },
    { to: '/cart', label: 'Cart', icon: '🛒', active: route === '/cart' || route === '/checkout' || route === '/payment', cls: 'nav-cart' },
    { to: signedIn ? '/account' : '/login', label: signedIn ? 'Account' : 'Sign in', icon: '◯', active: route === '/account' || route === '/login', cls: '' },
  ];
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="Vi-Medics home">
          <img src="/logo.png" alt="Vi-Medics" className="brand-logo" width="126" height="42" />
        </Link>
        <nav className="top-nav" aria-label="Main">
          {items.map((i) => (
            <Link key={i.label} to={i.to} className={`${i.cls} ${i.active ? 'nav-active' : ''}`.trim()} aria-current={i.active ? 'page' : undefined}>
              <span className="nav-icon" aria-hidden="true">
                {i.icon}
                {i.label === 'Cart' && cartCount > 0 && <b>{cartCount}</b>}
              </span>
              <span>{i.label}</span>
              {i.label === 'Cart' && cartCount > 0 && <span className="visually-hidden"> ({cartCount} items)</span>}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
