import { useState } from 'react';
import { STATUS_LABELS } from '../utils/taskStatus';
import { DESCRIPTION_MAX, EMPTY_TASK, TITLE_MAX, validateTaskForm } from '../utils/taskForm';

export default function TaskForm({
  initialValues = EMPTY_TASK,
  onSubmit,
  onCancel,
  submitLabel = 'Enregistrer',
  busy = false,
  idPrefix = 'task',
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  const update = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validateTaskForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(values);
  };

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor={`${idPrefix}-title`}>Titre *</label>
        <input
          id={`${idPrefix}-title`}
          type="text"
          value={values.title}
          onChange={update('title')}
          maxLength={TITLE_MAX}
          required
          autoComplete="off"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? `${idPrefix}-title-error` : undefined}
        />
        {errors.title && (
          <p className="field__error" id={`${idPrefix}-title-error`}>
            {errors.title}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-status`}>Statut *</label>
        <select
          id={`${idPrefix}-status`}
          value={values.status}
          onChange={update('status')}
          aria-invalid={Boolean(errors.status)}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.status && <p className="field__error">{errors.status}</p>}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-description`}>Description</label>
        <textarea
          id={`${idPrefix}-description`}
          value={values.description}
          onChange={update('description')}
          maxLength={DESCRIPTION_MAX}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={`${idPrefix}-description-hint`}
        />
        <p className="field__hint" id={`${idPrefix}-description-hint`}>
          {values.description.length} / {DESCRIPTION_MAX} caractères
        </p>
        {errors.description && <p className="field__error">{errors.description}</p>}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-dueDate`}>Échéance</label>
        <input
          id={`${idPrefix}-dueDate`}
          type="date"
          value={values.dueDate}
          onChange={update('dueDate')}
          aria-invalid={Boolean(errors.dueDate)}
          aria-describedby={`${idPrefix}-dueDate-hint`}
        />
        <p className="field__hint" id={`${idPrefix}-dueDate-hint`}>
          Facultatif. Laisser vide pour aucune échéance.
        </p>
        {errors.dueDate && <p className="field__error">{errors.dueDate}</p>}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Enregistrement…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
