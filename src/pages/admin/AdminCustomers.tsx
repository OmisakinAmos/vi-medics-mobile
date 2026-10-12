import { useEffect, useMemo, useState } from 'react';
import { ErrorMessage, Loading } from '../../components/StatusMessage';
import { money } from '../../lib/format';
import { adminListCustomers, type AdminCustomer } from '../../services/adminService';

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export function AdminCustomers() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    adminListCustomers()
      .then((c) => { setCustomers(c); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(
    () => customers.filter((c) => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(query.toLowerCase())),
    [customers, query],
  );

  return (
    <section>
      <div className="admin-toolbar">
        <div className="search-field"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or phone…" /></div>
      </div>
      {loading && <Loading label="Loading customers…" />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && <p className="admin-hint">{shown.length} customer{shown.length === 1 ? '' : 's'}</p>}
      <div className="admin-list">
        {shown.map((c) => (
          <div className="admin-row admin-customer" key={c.id}>
            <div className="admin-row-main">
              <strong>{c.name}</strong>
              <span>{c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}{c.phone && <> · <a href={`tel:${c.phone}`}>{c.phone}</a></>}</span>
              {c.address && <span>Last delivery address: {c.address}</span>}
              <span>Joined {formatDate(c.joined)}{c.lastOrder && <> · last order {formatDate(c.lastOrder)}</>}</span>
            </div>
            <div className="admin-stat"><strong>{c.orderCount}</strong><small>order{c.orderCount === 1 ? '' : 's'}</small><span>{money(c.totalSpent)}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}
