/**
 * Message d'information, de succès ou d'erreur.
 * role="alert" pour les erreurs (annoncé immédiatement par les lecteurs d'écran),
 * role="status" pour le reste (annoncé sans interrompre).
 */
export default function Alert({ type = 'info', children }) {
  if (!children) return null;
  return (
    <div className={`alert alert--${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
