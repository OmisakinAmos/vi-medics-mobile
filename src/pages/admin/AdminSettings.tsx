import { useEffect, useState, type FormEvent } from 'react';
import { ErrorMessage, Loading } from '../../components/StatusMessage';
import { adminSavePaymentSettings } from '../../services/adminService';
import { getPaymentDetails } from '../../services/orderService';

/** Bank details shown to customers on the payment page. */
export function AdminSettings() {
  const [form, setForm] = useState({ bankName: '', accountName: '', accountNumber: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getPaymentDetails()
      .then(setForm)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => { setSaved(false); setForm((f) => ({ ...f, [key]: e.target.value })); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { await adminSavePaymentSettings(form); setSaved(true); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  if (loading) return <Loading />;

  return (
    <form className="form-card admin-form" onSubmit={save}>
      <h2>Payment settings</h2>
      <p className="admin-hint">These bank details are shown to customers when they pay by bank transfer. Check them carefully: customers will send money to this account. Every change is recorded in the audit trail.</p>
      <div className="form-grid">
        <label>Bank name<input value={form.bankName} onChange={set('bankName')} placeholder="e.g. Access Bank" /></label>
        <label>Account name<input required value={form.accountName} onChange={set('accountName')} placeholder="Name on the account" /></label>
        <label>Account number<input required inputMode="numeric" value={form.accountNumber} onChange={set('accountNumber')} placeholder="10-digit account number" /></label>
      </div>
      {error && <ErrorMessage message={error} />}
      {saved && <div className="admin-notice" style={{ marginTop: 12 }}>Saved. Customers now see these details.</div>}
      <button className="primary-button" type="submit" disabled={busy} style={{ marginTop: 14 }}>{busy ? 'Saving…' : 'Save payment details'}</button>
    </form>
  );
}
