import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Alert from '../components/Alert';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';
import TaskForm from '../components/TaskForm';
import { fromTask, toApiPayload } from '../utils/taskForm';
import { formatCivilDate, formatDateTime } from '../utils/dates';
import { useAuth } from '../context/useAuth';

/** Ne garde que les champs réellement modifiés : le PATCH reste partiel. */
function diffPayload(before, after) {
  const changes = {};
  for (const key of Object.keys(after)) {
    if (after[key] !== before[key]) changes[key] = after[key];
  }
  return changes;
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const { request } = useAuth();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let cancelled = false;
    request(`/tasks/${id}`)
      .then((data) => {
        if (!cancelled) setTask(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 404 || err.status === 400) setNotFound(true);
        else setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, request]);

  const handleUpdate = async (values) => {
    setError(null);
    setSuccess(null);
    const changes = diffPayload(toApiPayload(fromTask(task)), toApiPayload(values));
    if (Object.keys(changes).length === 0) {
      setEditing(false);
      setSuccess('Aucune modification à enregistrer.');
      return;
    }
    setBusy(true);
    try {
      const updated = await request(`/tasks/${id}`, { method: 'PATCH', body: changes });
      setTask(updated);
      setEditing(false);
      setSuccess('Tâche mise à jour.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    setBusy(true);
    try {
      await request(`/tasks/${id}`, { method: 'DELETE' });
      navigate('/tasks', { state: { flash: `Tâche « ${task.title} » supprimée.` } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  if (loading) {
    return (
      <p className="muted" role="status">
        Chargement de la tâche…
      </p>
    );
  }

  if (notFound) {
    return (
      <section className="card card--narrow">
        <h1>Tâche introuvable</h1>
        <p className="muted">Cette tâche n’existe pas ou ne vous appartient pas.</p>
        <Link to="/tasks" className="btn">
          Retour à mes tâches
        </Link>
      </section>
    );
  }

  if (!task) {
    return (
      <section className="card card--narrow">
        <Alert type="error">{error}</Alert>
        <Link to="/tasks" className="btn">
          Retour à mes tâches
        </Link>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="task-title">
      <div className="page-header">
        <h1 id="task-title">{editing ? 'Modifier la tâche' : task.title}</h1>
        <Link to="/tasks">← Mes tâches</Link>
      </div>

      <Alert type="success">{success}</Alert>
      <Alert type="error">{error}</Alert>

      {editing ? (
        <TaskForm
          initialValues={fromTask(task)}
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
          submitLabel="Enregistrer les modifications"
          busy={busy}
          idPrefix="edit-task"
        />
      ) : (
        <>
          <dl className="detail-grid">
            <dt>Statut</dt>
            <dd>
              <StatusBadge status={task.status} />
            </dd>
            <dt>Priorité</dt>
            <dd>
              <PriorityBadge priority={task.priority} />
            </dd>
            <dt>Échéance</dt>
            <dd>{formatCivilDate(task.dueDate)}</dd>
            {task.completedAt && (
              <>
                <dt>Terminée le</dt>
                <dd>{formatDateTime(task.completedAt)}</dd>
              </>
            )}
            <dt>Description</dt>
            <dd>{task.description ? task.description : <span className="muted">Aucune description</span>}</dd>
            <dt>Identifiant</dt>
            <dd>
              <code>{task.id}</code>
            </dd>
          </dl>

          <div className="form-actions" style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setSuccess(null);
                setEditing(true);
              }}
              disabled={busy}
            >
              Modifier
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy || confirmingDelete}
              aria-expanded={confirmingDelete}
              aria-controls="confirm-delete"
            >
              Supprimer
            </button>
          </div>

          {confirmingDelete && (
            <div className="confirm-box" id="confirm-delete" role="alertdialog" aria-labelledby="confirm-delete-title">
              <p id="confirm-delete-title">
                <strong>Supprimer définitivement « {task.title} » ?</strong> Cette action est irréversible.
              </p>
              <div className="form-actions">
                <button type="button" className="btn btn--danger" onClick={handleDelete} disabled={busy} autoFocus>
                  {busy ? 'Suppression…' : 'Oui, supprimer'}
                </button>
                <button type="button" className="btn" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
