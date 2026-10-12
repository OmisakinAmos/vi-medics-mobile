import { useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { ErrorMessage, Loading } from '../components/StatusMessage';
import { checkIsAdmin } from '../services/adminService';
import type { Navigate } from '../types';
import { AdminCustomers } from './admin/AdminCustomers';
import { AdminOrders } from './admin/AdminOrders';
import { AdminProducts } from './admin/AdminProducts';

type Tab = 'products' | 'orders' | 'customers';
const TABS: { id: Tab; label: string }[] = [
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'customers', label: 'Customers' },
];

/** Admin area. Access is decided by the database (is_admin()); this page only reflects it. */
export function Admin({ onNavigate, onRequireLogin }: { onNavigate: Navigate; onRequireLogin: () => void }) {
  const { user, loading: authLoading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('products');

  useEffect(() => {
    if (!user) { setAllowed(null); return; }
    let active = true;
    setAllowed(null);
    checkIsAdmin()
      .then((ok) => active && setAllowed(ok))
      .catch((e: Error) => active && setError(e.message));
    return () => { active = false; };
  }, [user?.id]);

  if (authLoading) return <main className="page"><div className="container"><Loading /></div></main>;

  if (!user) {
    return (
      <main className="page"><div className="container narrow">
        <div className="empty-state large"><h2>Admin sign in</h2><p>Sign in with the admin account to continue.</p><button className="primary-button" onClick={onRequireLogin}>Sign in →</button></div>
      </div></main>
    );
  }
  if (error) return <main className="page"><div className="container"><ErrorMessage message={error} /></div></main>;
  if (allowed === null) return <main className="page"><div className="container"><Loading label="Checking access…" /></div></main>;
  if (!allowed) {
    return (
      <main className="page"><div className="container narrow">
        <div className="empty-state large"><h2>No access</h2><p>This account is not an administrator.</p><button className="primary-button" onClick={() => onNavigate('/')}>Back to the shop →</button></div>
      </div></main>
    );
  }

  return (
    <main className="page"><div className="container">
      <div className="page-heading"><div><span className="eyebrow">ADMIN</span><h1>Store admin</h1><p>Manage products, view customers and update orders.</p></div></div>
      <div className="admin-tabs" role="tablist">
        {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'admin-tab admin-tab-active' : 'admin-tab'} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      {tab === 'products' && <AdminProducts />}
      {tab === 'orders' && <AdminOrders />}
      {tab === 'customers' && <AdminCustomers />}
    </div></main>
  );
}
