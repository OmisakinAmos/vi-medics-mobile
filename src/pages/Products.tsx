import { useMemo, useState } from 'react';
import { ProductCard } from '../components/ProductCard';
import { ErrorMessage, Loading } from '../components/StatusMessage';
import { categories } from '../data/products';
import { useProducts } from '../hooks';
import type { Navigate, Product } from '../types';

export function Products({ onNavigate, onAdd }: { onNavigate: Navigate; onAdd: (p: Product) => void }) {
  const { data: products, loading, error } = useProducts();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const filtered = useMemo(
    () => products.filter((p) => (category === 'All' || p.category === category) && `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(query.toLowerCase())),
    [products, query, category],
  );
  return (
    <main className="page"><div className="container">
      <div className="page-heading"><div><span className="eyebrow">CATALOGUE</span><h1>Medical equipment</h1><p>Browse devices and equipment with clear pricing and stock information.</p></div></div>
      <div className="catalog-toolbar">
        <div className="search-field"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products, brands or categories..." /></div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}><option>All</option>{categories.map((c) => <option key={c.name}>{c.name}</option>)}</select>
      </div>
      <div className="catalog-layout">
        <aside className="filters">
          <strong>Categories</strong>
          <button className={category === 'All' ? 'filter-active' : ''} onClick={() => setCategory('All')}>All products</button>
          {categories.map((c) => <button key={c.name} className={category === c.name ? 'filter-active' : ''} onClick={() => setCategory(c.name)}>{c.name}</button>)}
          <div className="filter-note"><strong>Stock visibility</strong><p>Products show current stock levels. Out-of-stock products cannot be added to the cart.</p></div>
        </aside>
        <div className="catalog-results">
          {loading && <Loading label="Loading products…" />}
          {error && <ErrorMessage message={error} />}
          {!loading && !error && <>
            <div className="results-top"><span>{filtered.length} products</span><span>Sort: Featured</span></div>
            <div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} onView={() => onNavigate(`/product/${product.id}`)} onAdd={() => onAdd(product)} />)}</div>
            {filtered.length === 0 && <div className="empty-state"><strong>No products found</strong><p>Try another search or category.</p></div>}
          </>}
        </div>
      </div>
    </div></main>
  );
}
