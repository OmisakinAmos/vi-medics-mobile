import type { Navigate } from '../types';
import { Link } from './Link';

type Props = { route: string; signedIn: boolean; cartCount: number; mobileOpen: boolean; onToggleMenu: () => void; onNavigate: Navigate };

export function Header({ route, signedIn, cartCount, mobileOpen, onToggleMenu, onNavigate }: Props) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="Vi-Medics home">
          <span className="brand-mark">V</span>
          <span><strong>VI-MEDICS</strong><small>Medical Equipment</small></span>
        </Link>
        <nav className={`main-nav ${mobileOpen ? 'main-nav--open' : ''}`}>
          <Link to="/" className={route === '/' ? 'nav-active' : ''}>Home</Link>
          <Link to="/products" className={route.startsWith('/product') ? 'nav-active' : ''}>Products</Link>
          <Link to="/about" className={route === '/about' ? 'nav-active' : ''}>About</Link>
        </nav>
        <div className="header-actions">
          <button className="icon-button search-button" aria-label="Search products" onClick={() => onNavigate('/products')}><span>⌕</span><em>Search</em></button>
          <button className="icon-button cart-button" aria-label="Shopping cart" onClick={() => onNavigate('/cart')}><span>🛒</span>{cartCount > 0 && <b>{cartCount}</b>}</button>
          <button className="icon-button" aria-label="Account" onClick={() => onNavigate(signedIn ? '/account' : '/login')}>◯</button>
        </div>
        <button className="mobile-menu" onClick={onToggleMenu} aria-label="Toggle menu">{mobileOpen ? '×' : '☰'}</button>
      </div>
    </header>
  );
}
