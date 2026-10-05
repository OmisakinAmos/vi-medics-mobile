import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import type { Navigate } from '../types';

export function Login({ onNavigate, onSuccess }: { onNavigate: Navigate; onSuccess: () => void }) {
  const { enabled, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password, fullName);
    setBusy(false);
    if (result.error) return setError(result.error);
    if (result.needsConfirmation) return setInfo('Account created. Check your email to confirm your address, then sign in.');
    onSuccess();
  };

  return (
    <main className="auth-page"><div className="auth-card">
      <div className="auth-logo">V</div>
      <span className="eyebrow">{mode === 'signin' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}</span>
      <h1>{mode === 'signin' ? 'Sign in to Vi-Medics' : 'Join Vi-Medics'}</h1>
      <p>Access your orders and continue shopping for medical equipment.</p>

      {!enabled ? (
        <small>Sign-in is unavailable because the database is not configured.</small>
      ) : (
        <form className="checkout-form" onSubmit={submit} style={{ textAlign: 'left' }}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            {mode === 'signup' && <label>Full name<input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" /></label>}
            <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
            <label>Password
              <span style={{ position: 'relative', display: 'block' }}>
                <input required type={showPassword ? 'text' : 'password'} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} style={{ width: '100%', paddingRight: 64 }} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', color: 'var(--blue)', fontWeight: 700, fontSize: 12 }}>{showPassword ? 'Hide' : 'Show'}</button>
              </span>
            </label>
          </div>
          {error && <div role="alert" style={{ color: '#b42318', fontSize: 14 }}>{error}</div>}
          {info && <div role="status" style={{ color: '#067647', fontSize: 14 }}>{info}</div>}
          <button className="primary-button wide" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in →' : 'Create account →'}</button>
          <button type="button" className="text-button wide" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null); }}>
            {mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </button>
        </form>
      )}
      <button className="text-button" onClick={() => onNavigate('/products')}>Continue browsing</button>
    </div></main>
  );
}
