import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';
import { useAuth } from '../context/useAuth';

const PASSWORD_MIN_LENGTH = 8;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`);
      return;
    }
    setBusy(true);
    try {
      await register({ email: email.trim(), password });
      navigate('/tasks', { replace: true, state: { flash: 'Bienvenue ! Votre compte est créé.' } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card--narrow" aria-labelledby="register-title">
      <h1 id="register-title">Créer un compte</h1>
      <p className="muted">Vos tâches ne seront visibles que par vous.</p>

      <Alert type="error">{error}</Alert>

      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="register-password">Mot de passe</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={PASSWORD_MIN_LENGTH}
            required
            aria-describedby="register-password-hint"
          />
          <p className="field__hint" id="register-password-hint">
            Au moins {PASSWORD_MIN_LENGTH} caractères.
          </p>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Création…' : 'Créer mon compte'}
          </button>
        </div>
      </form>

      <p>
        Déjà inscrit ? <Link to="/login">Se connecter</Link>
      </p>
    </section>
  );
}
