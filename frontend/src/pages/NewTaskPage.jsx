import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';
import TaskForm from '../components/TaskForm';
import { toApiPayload } from '../utils/taskForm';
import { useAuth } from '../context/useAuth';

export default function NewTaskPage() {
  const { request } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (values) => {
    setError(null);
    setBusy(true);
    try {
      const created = await request('/tasks', { method: 'POST', body: toApiPayload(values) });
      navigate('/tasks', { state: { flash: `Tâche « ${created.title} » créée.` } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <section className="card card--narrow" aria-labelledby="new-task-heading">
      <h1 id="new-task-heading">Nouvelle tâche</h1>
      <Alert type="error">{error}</Alert>
      <TaskForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/tasks')}
        submitLabel="Créer la tâche"
        busy={busy}
        idPrefix="new-task"
      />
    </section>
  );
}
