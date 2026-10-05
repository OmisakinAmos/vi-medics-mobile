import type { Navigate } from '../types';

export function Footer({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div><div className="footer-brand">VI-MEDICS</div><p>Medical equipment for homes, clinics and healthcare professionals.</p></div>
        <div><h4>Shop</h4><button onClick={() => onNavigate('/products')}>All Products</button><button onClick={() => onNavigate('/products')}>Categories</button></div>
        <div><h4>Account</h4><button onClick={() => onNavigate('/login')}>Sign In</button><button onClick={() => onNavigate('/account')}>My Orders</button></div>
        <div><h4>Support</h4><span>help@vi-medics.example</span><a href="tel:+2348113867495" style={{ display: 'block', color: '#9fb9bf', fontSize: 10, lineHeight: 1.7, textDecoration: 'none' }}>+234 811 386 7495</a><span>Lagos, Nigeria</span></div>
      </div>
      <div className="container footer-bottom"><span>© 2026 Vi-Medics. HNG15 Lesson 2 project.</span><span>Privacy · Terms</span></div>
    </footer>
  );
}
