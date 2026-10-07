import { STATUS_LABELS } from '../utils/taskStatus';

export default function StatusBadge({ status }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}
