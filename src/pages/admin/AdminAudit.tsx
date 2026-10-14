import { useEffect, useMemo, useState } from 'react';
import { ErrorMessage, Loading } from '../../components/StatusMessage';
import { downloadCsv } from '../../lib/csv';
import { formatDateTime } from '../../lib/format';
import { adminListAudit, type AuditEntry } from '../../services/adminService';

const PAGE = 300;
const ENTITIES = ['order', 'product', 'expense', 'user', 'settings'];

export function AdminAudit() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [limit, setLimit] = useState(PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState('all');
  const [role, setRole] = useState('all');
  const [from, setFrom] = useState('');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    adminListAudit(limit)
      .then((e) => { setEntries(e); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [limit]);

  const shown = useMemo(() => {
    const since = from ? new Date(`${from}T00:00:00`).getTime() : 0;
    const q = query.trim().toLowerCase();
    return entries.filter((e) =>
      (entity === 'all' || e.entity === entity) &&
      (role === 'all' || e.actorRole === role) &&
      new Date(e.createdAt).getTime() >= since &&
      (!q || `${e.summary} ${e.actorEmail} ${e.actorName} ${e.action} ${e.entityId}`.toLowerCase().includes(q)),
    );
  }, [entries, entity, role, from, query]);

  const exportCsv = () =>
    downloadCsv(`vi-medics-audit-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Time (Lagos)', 'Who', 'Email', 'Role', 'Action', 'Item', 'Summary', 'Details'],
      ...shown.map((e) => [formatDateTime(e.createdAt), e.actorName, e.actorEmail, e.actorRole, e.action, `${e.entity} ${e.entityId}`, e.summary, JSON.stringify(e.details)]),
    ]);

  return (
    <section>
      <p className="admin-hint" style={{ marginTop: 0 }}>A permanent record of who did what and when: orders, payments, deliveries, product and payment-setting changes, new accounts, sign-ins and sign-outs. Entries cannot be edited or deleted from the app.</p>
      <div className="admin-toolbar">
        <div className="search-field"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search person, email, order, action…" /></div>
        <select value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Type">
          <option value="all">All types</option>
          {ENTITIES.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Who">
          <option value="all">Everyone</option>
          <option value="admin">Admin</option>
          <option value="customer">Customers</option>
          <option value="system">System</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="admin-date" />
        <button className="outline-button" onClick={exportCsv} disabled={shown.length === 0}>Download (CSV)</button>
      </div>
      {loading && <Loading label="Loading audit trail…" />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && shown.length === 0 && <div className="empty-state"><strong>No activity found</strong></div>}
      <div className="admin-list">
        {shown.map((e) => (
          <div key={e.id} className="admin-order">
            <button className="admin-row audit-row" onClick={() => setOpenId(openId === e.id ? null : e.id)} aria-expanded={openId === e.id}>
              <div className="admin-row-main">
                <strong>{e.summary}</strong>
                <span>{formatDateTime(e.createdAt)} · {e.actorName || e.actorEmail || 'System'}{e.actorName && e.actorEmail ? ` (${e.actorEmail})` : ''}</span>
              </div>
              <i className={`admin-badge audit-${e.actorRole}`}>{e.actorRole}</i>
            </button>
            {openId === e.id && (
              <div className="admin-details">
                <p><strong>Action:</strong> {e.action}<br /><strong>Item:</strong> {e.entity} {e.entityId}<br /><strong>Time:</strong> {formatDateTime(e.createdAt)}<br /><strong>By:</strong> {e.actorName || '—'} {e.actorEmail && `· ${e.actorEmail}`} · {e.actorRole}</p>
                {Object.keys(e.details).length > 0 && <pre className="audit-details">{JSON.stringify(e.details, null, 2)}</pre>}
              </div>
            )}
          </div>
        ))}
      </div>
      {!loading && entries.length >= limit && <button className="outline-button" style={{ marginTop: 14 }} onClick={() => setLimit(limit + PAGE)}>Load older activity</button>}
    </section>
  );
}
