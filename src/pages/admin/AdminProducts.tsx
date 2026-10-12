import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ProductVisual } from '../../components/ProductVisual';
import { ErrorMessage, Loading } from '../../components/StatusMessage';
import { money } from '../../lib/format';
import {
  CATEGORY_NAMES, PRODUCT_STATUSES, adminListProducts, adminSaveProduct, blankProduct, nextProductId, uploadProductImage,
  type AdminProduct,
} from '../../services/adminService';
import type { Category, ProductStatus } from '../../types';

export function AdminProducts() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    adminListProducts()
      .then((p) => { setProducts(p); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const shown = useMemo(
    () => products.filter((p) => `${p.name} ${p.id} ${p.category} ${p.brand}`.toLowerCase().includes(query.toLowerCase())),
    [products, query],
  );

  if (editing) {
    return (
      <ProductForm
        initial={editing}
        isNew={isNew}
        onCancel={() => setEditing(null)}
        onSaved={(name) => { setEditing(null); setNotice(`Saved “${name}”.`); load(); }}
      />
    );
  }

  return (
    <section>
      <div className="admin-toolbar">
        <div className="search-field"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" /></div>
        <button className="primary-button admin-add" onClick={() => { setIsNew(true); setEditing(blankProduct(nextProductId(products))); setNotice(null); }}>+ Add product</button>
      </div>
      {notice && <div className="admin-notice" role="status">{notice}</div>}
      {loading && <Loading label="Loading products…" />}
      {error && <ErrorMessage message={error} />}
      {!loading && !error && (
        <div className="admin-list">
          {shown.map((p) => (
            <div className="admin-row" key={p.id}>
              <div className="admin-thumb"><ProductVisual product={p} /></div>
              <div className="admin-row-main">
                <strong>{p.name}</strong>
                <span>{p.id} · {p.category}</span>
                <span>{money(p.price)} · {p.stockQuantity} in stock · <em className={`admin-badge admin-badge-${p.status}`}>{p.status}</em></span>
                {!p.description && <span className="admin-warn">No description yet</span>}
              </div>
              <button className="outline-button" onClick={() => { setIsNew(false); setEditing(p); setNotice(null); }}>Edit</button>
            </div>
          ))}
          {shown.length === 0 && <div className="empty-state"><strong>No products found</strong></div>}
        </div>
      )}
    </section>
  );
}

function ProductForm({ initial, isNew, onCancel, onSaved }: { initial: AdminProduct; isNew: boolean; onCancel: () => void; onSaved: (name: string) => void }) {
  const [p, setP] = useState<AdminProduct>(initial);
  const [price, setPrice] = useState(String(initial.price));
  const [stock, setStock] = useState(String(initial.stockQuantity));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = (k: 'name' | 'description' | 'shortDescription' | 'brand' | 'model' | 'warranty') => (e: { target: { value: string } }) => setP({ ...p, [k]: e.target.value });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true); setError(null);
    try { setP({ ...p, imageUrl: await uploadProductImage(file, p.id) }); }
    catch (e) { setError(`Photo upload failed: ${(e as Error).message}`); }
    finally { setUploading(false); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const priceNum = Number(price);
    const stockNum = Number(stock);
    if (!p.name.trim()) return setError('Enter a product name.');
    if (!Number.isFinite(priceNum) || priceNum < 0) return setError('Enter a valid price.');
    if (!Number.isInteger(stockNum) || stockNum < 0) return setError('Stock must be a whole number, 0 or more.');
    setSaving(true); setError(null);
    try {
      await adminSaveProduct({ ...p, price: priceNum, stockQuantity: stockNum });
      onSaved(p.name.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <form className="checkout-form admin-form" onSubmit={submit}>
      <div className="form-card">
        <h2>{isNew ? 'Add product' : `Edit ${initial.name}`} <small className="admin-id">{p.id}</small></h2>
        <div className="form-grid">
          <label className="full">Product name<input required value={p.name} onChange={text('name')} placeholder="e.g. Digital Blood Pressure Monitor" /></label>
          <label>Category
            <select value={p.category} onChange={(e) => setP({ ...p, category: e.target.value as Category, visual: '' })}>
              {CATEGORY_NAMES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Status
            <select value={p.status} onChange={(e) => setP({ ...p, status: e.target.value as ProductStatus })}>
              {PRODUCT_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>Price (₦)<input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <label>Stock quantity<input required inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} /></label>
          <label>Brand<input value={p.brand} onChange={text('brand')} /></label>
          <label>Model<input value={p.model} onChange={text('model')} /></label>
          <label className="full">Warranty<input value={p.warranty} onChange={text('warranty')} placeholder="e.g. 12 months, or Single use" /></label>
          <label className="full">Short description (one line, optional)<input value={p.shortDescription ?? ''} onChange={text('shortDescription')} /></label>
          <label className="full">Description<textarea rows={6} value={p.description} onChange={text('description')} placeholder="What the product is and what it includes. Only use information supplied for this product; do not add medical claims." /></label>
        </div>
      </div>

      <div className="form-card">
        <h2>Photo</h2>
        <div className="admin-photo">
          <div className="admin-thumb admin-thumb-large"><ProductVisual product={p} /></div>
          <div>
            <label className="outline-button admin-file">{uploading ? 'Uploading…' : p.imageUrl ? 'Replace photo' : 'Choose photo'}
              <input type="file" accept="image/*" disabled={uploading} onChange={(e) => onFile(e.target.files?.[0])} hidden />
            </label>
            {p.imageUrl && <button type="button" className="text-button" onClick={() => setP({ ...p, imageUrl: null })}>Remove photo</button>}
            <p className="admin-hint">Photos upload straight away; tap Save to attach it to this product. “Draft” or “archived” hides a product from the shop.</p>
          </div>
        </div>
      </div>

      {error && <div className="admin-error" role="alert">{error}</div>}
      <div className="service-cta">
        <button className="primary-button" disabled={saving || uploading}>{saving ? 'Saving…' : 'Save product'}</button>
        <button type="button" className="outline-button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
