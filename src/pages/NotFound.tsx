import { Link } from '../components/Link';

export function NotFound() {
  return (
    <main className="page"><div className="container narrow">
      <div className="empty-state large">
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist or has moved.</p>
        <Link to="/products" className="primary-button">Browse medical equipment →</Link>
      </div>
    </div></main>
  );
}
