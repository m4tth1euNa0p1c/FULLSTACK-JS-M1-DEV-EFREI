import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="card card--narrow">
      <h1>Page introuvable</h1>
      <p className="muted">L’adresse demandée ne correspond à aucune page.</p>
      <Link to="/tasks" className="btn">
        Retour à l’accueil
      </Link>
    </section>
  );
}
