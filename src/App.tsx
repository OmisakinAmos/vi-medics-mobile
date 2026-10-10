import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import type { PlacedOrder } from './services/orderService';
import { Footer } from './components/Footer';
import { BottomNav } from './components/BottomNav';
import { Header } from './components/Header';
import { go } from './lib/format';
import { About } from './pages/About';
import { Account } from './pages/Account';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { Confirmation } from './pages/Confirmation';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { ProductDetails } from './pages/ProductDetails';
import { Products } from './pages/Products';
import { NotFound } from './pages/NotFound';
import { SITE_NAME, breadcrumbLd, useSeo, type Seo } from './lib/seo';
import type { CartItem, Product } from './types';

const CART_KEY = 'vi-medics-cart';

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

// Old hash links (#/products) are upgraded to real URLs (/products) so earlier shares keep working.
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState({}, '', window.location.hash.slice(1));
}

const currentRoute = () => window.location.pathname.replace(/\/+$/, '') || '/';

const KNOWN = ['/', '/products', '/cart', '/checkout', '/login', '/account', '/about', '/confirmation'];
const isKnown = (r: string) => KNOWN.includes(r) || /^\/product\/[^/]+$/.test(r);

const PRIVATE: Record<string, string> = {
  '/cart': 'Your cart',
  '/checkout': 'Checkout',
  '/login': 'Sign in or create an account',
  '/account': 'My account and orders',
  '/confirmation': 'Order confirmation',
};

/** Title/description for pages whose content does not depend on loaded data. Product pages set their own. */
function pageSeo(route: string): Seo | null {
  if (route === '/') {
    return {
      path: '/',
      title: 'Vi-Medics | Medical Equipment for Clinics & Healthcare Professionals in Nigeria',
      description: 'Buy dependable medical devices and equipment online in Nigeria. Clear pricing, live stock levels and secure checkout for clinics, diagnostic centres and healthcare professionals.',
      jsonLd: [breadcrumbLd([{ name: 'Home', path: '/' }])],
    };
  }
  if (route === '/products') {
    return {
      path: '/products',
      title: `Medical Equipment Catalogue | ${SITE_NAME}`,
      description: 'Browse monitoring, diagnostic, respiratory and mobility equipment with clear prices and stock levels. Supplies for clinics, diagnostic centres and healthcare professionals in Nigeria.',
      jsonLd: [breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'Products', path: '/products' }])],
    };
  }
  if (route === '/about') {
    return {
      path: '/about',
      title: `About ${SITE_NAME} | Medical Equipment Supplier in Nigeria`,
      description: 'Vi-Medics supplies medical devices and equipment to clinics, diagnostic centres, healthcare professionals and families, with clear product information and stock-aware ordering.',
      jsonLd: [breadcrumbLd([{ name: 'Home', path: '/' }, { name: 'About', path: '/about' }])],
    };
  }
  if (PRIVATE[route]) {
    return { path: route, title: `${PRIVATE[route]} | ${SITE_NAME}`, description: 'Vi-Medics medical equipment store.', noindex: true };
  }
  if (!isKnown(route)) {
    return { path: route, title: `Page not found | ${SITE_NAME}`, description: 'This page could not be found.', noindex: true };
  }
  return null; // product pages manage their own SEO
}

export function App() {
  const [route, setRoute] = useState(currentRoute());
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<PlacedOrder | null>(null);
  const postLogin = useRef('/account');
  const { user } = useAuth();

  useEffect(() => {
    const onNav = () => setRoute(currentRoute());
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  useEffect(() => setMobileOpen(false), [route]);
  useSeo(pageSeo(route));

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* storage unavailable */ }
  }, [cart]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const addToCart = (product: Product) => {
    if (product.stockQuantity <= 0) return;
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) return current.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stockQuantity) } : item);
      return [...current, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, quantity: number) => {
    setCart((current) => current.map((item) => item.product.id === id ? { ...item, quantity: Math.max(1, Math.min(quantity, item.product.stockQuantity)) } : item));
  };

  const removeFromCart = (id: string) => setCart((current) => current.filter((item) => item.product.id !== id));

  const navigate = (path: string) => { go(path); setMobileOpen(false); };

  const requireLogin = (returnTo: string) => { postLogin.current = returnTo; navigate('/login'); };
  const handlePlaced = (order: PlacedOrder) => { setLastOrder(order); setCart([]); };

  return (
    <div className="site-shell">
      <Header route={route} signedIn={Boolean(user)} cartCount={cartCount} mobileOpen={mobileOpen} onToggleMenu={() => setMobileOpen((v) => !v)} onNavigate={navigate} />

      {route === '/' && <Home onNavigate={navigate} onAdd={addToCart} />}
      {route === '/products' && <Products onNavigate={navigate} onAdd={addToCart} />}
      {route.startsWith('/product/') && <ProductDetails id={route.split('/')[2]} onNavigate={navigate} onAdd={addToCart} />}
      {route === '/cart' && <Cart cart={cart} onNavigate={navigate} onUpdate={updateQuantity} onRemove={removeFromCart} />}
      {route === '/checkout' && <Checkout cart={cart} onNavigate={navigate} onRequireLogin={() => requireLogin('/checkout')} onPlaced={handlePlaced} />}
      {route === '/login' && <Login onNavigate={navigate} onSuccess={() => { const to = postLogin.current; postLogin.current = '/account'; navigate(to); }} />}
      {route === '/account' && <Account onNavigate={navigate} />}
      {route === '/about' && <About />}
      {route === '/confirmation' && <Confirmation order={lastOrder} onNavigate={navigate} />}
      {!isKnown(route) && <NotFound />}

      <Footer onNavigate={navigate} />
      <BottomNav route={route} cartCount={cartCount} signedIn={Boolean(user)} onNavigate={navigate} />
    </div>
  );
}
