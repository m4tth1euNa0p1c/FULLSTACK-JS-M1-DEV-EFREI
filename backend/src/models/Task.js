const { Schema, model } = require('mongoose');

const TASK_STATUSES = ['todo', 'doing', 'done'];
// Bonus B1 : niveau de priorité, facultatif à la création (medium par défaut).
const TASK_PRIORITIES = ['low', 'medium', 'high'];

const taskSchema = new Schema(
  {
    // Propriétaire : toujours déduit du JWT côté serveur, jamais du corps de la requête.
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    status: { type: String, required: true, enum: TASK_STATUSES },
    priority: { type: String, required: true, enum: TASK_PRIORITIES, default: 'medium' },
    description: { type: String, default: '', maxlength: 1000 },
    // Date civile stockée telle quelle ("YYYY-MM-DD") : pas d'heure, donc pas de fuseau horaire.
    dueDate: { type: String, default: null },
  },
  { timestamps: true },
);

// Contrat public : "id" (chaîne) plutôt que "_id", et pas d'ownerId exposé.
taskSchema.set('toJSON', {
  transform: (_doc, ret) => ({
    id: ret._id.toString(),
    title: ret.title,
    status: ret.status,
    priority: ret.priority,
    description: ret.description,
    dueDate: ret.dueDate,
    createdAt: ret.createdAt,
    updatedAt: ret.updatedAt,
  }),
});

module.exports = model('Task', taskSchema);
module.exports.TASK_STATUSES = TASK_STATUSES;
module.exports.TASK_PRIORITIES = TASK_PRIORITIES;
