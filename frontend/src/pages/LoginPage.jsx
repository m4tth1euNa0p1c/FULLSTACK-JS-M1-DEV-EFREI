import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';
import { useAuth } from '../context/useAuth';

export default function LoginPage() {
  const { login, isAuthenticated, notice, clearNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) return <Navigate to="/tasks" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login({ email: email.trim(), password });
      clearNotice();
      navigate(location.state?.from ?? '/tasks', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card--narrow" aria-labelledby="login-title">
      <h1 id="login-title">Connexion</h1>
      <p className="muted">Accédez à vos tâches personnelles.</p>

      <Alert type="info">{notice}</Alert>
      <Alert type="error">{error}</Alert>

      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Mot de passe</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </div>
      </form>

      <p>
        Pas encore de compte ? <Link to="/register">Créer un compte</Link>
      </p>
    </section>
  );
}
