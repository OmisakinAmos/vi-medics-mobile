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

const currentRoute = () => window.location.hash.replace('#', '') || '/';

export function App() {
  const [route, setRoute] = useState(currentRoute());
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<PlacedOrder | null>(null);
  const postLogin = useRef('/account');
  const { user } = useAuth();

  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

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

      <Footer onNavigate={navigate} />
      <BottomNav route={route} cartCount={cartCount} signedIn={Boolean(user)} onNavigate={navigate} />
    </div>
  );
}
