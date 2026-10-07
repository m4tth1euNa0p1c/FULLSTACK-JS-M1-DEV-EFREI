import { PRIORITY_LABELS } from '../utils/taskStatus';

// Bonus B1 : pastille de priorité (Basse / Moyenne / Haute).
export default function PriorityBadge({ priority }) {
  return (
    <span className={`badge badge--priority-${priority}`}>
      Priorité {PRIORITY_LABELS[priority]?.toLowerCase() ?? priority}
    </span>
  );
}
