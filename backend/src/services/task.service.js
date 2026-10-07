const Task = require('../models/Task');
const { notFound } = require('../utils/errors');
const { computeWeeklyStats } = require('../utils/weeklyStats');

/**
 * Toutes les requêtes filtrent sur ownerId : une tâche qui n'appartient pas
 * à l'utilisateur est indiscernable d'une tâche inexistante (404 dans les deux cas).
 * ownerId vient de req.user.id, donc du JWT vérifié, jamais du client.
 */

/**
 * Bonus B1 : traduit les filtres validés en filtre MongoDB.
 * Les dates civiles "YYYY-MM-DD" se comparent comme des chaînes : l'ordre
 * alphabétique est l'ordre chronologique. MongoDB ne compare $lt/$gte qu'entre
 * valeurs de même type, donc une dueDate null n'est jamais "inférieure" à une date.
 */
function buildListFilter(ownerId, { status, priority, due, today } = {}) {
  const conditions = [{ ownerId }];
  if (status) conditions.push({ status });
  if (priority) conditions.push({ priority });
  if (due === 'overdue') conditions.push({ dueDate: { $lt: today } }, { status: { $ne: 'done' } });
  if (due === 'today') conditions.push({ dueDate: today });
  if (due === 'upcoming') conditions.push({ dueDate: { $gte: today } });
  if (due === 'none') conditions.push({ dueDate: null });
  return conditions.length === 1 ? conditions[0] : { $and: conditions };
}

async function listTasks(ownerId, filters = {}) {
  const tasks = await Task.find(buildListFilter(ownerId, filters)).sort({ createdAt: -1 });
  return tasks.map((task) => task.toJSON());
}

async function createTask(ownerId, data) {
  // Bonus B4 : une tâche créée directement "done" est terminée à l'instant de sa création.
  const completedAt = data.status === 'done' ? new Date() : null;
  const task = await Task.create({ ...data, ownerId, completedAt });
  return task.toJSON();
}

async function getTask(ownerId, taskId) {
  const task = await Task.findOne({ _id: taskId, ownerId });
  if (!task) throw notFound('Tâche introuvable');
  return task.toJSON();
}

/**
 * Lecture puis sauvegarde (deux requêtes) plutôt que findOneAndUpdate : on a besoin
 * de l'état précédent pour gérer completedAt, et save() rejoue les validateurs Mongoose.
 */
async function updateTask(ownerId, taskId, changes) {
  const task = await Task.findOne({ _id: taskId, ownerId });
  if (!task) throw notFound('Tâche introuvable');

  task.set(changes);

  // Bonus B4 : completedAt suit le statut et n'est jamais fourni par le client.
  if (changes.status !== undefined) {
    if (changes.status === 'done') {
      if (!task.completedAt) task.completedAt = new Date();
    } else {
      task.completedAt = null;
    }
  }

  await task.save();
  return task.toJSON();
}

async function deleteTask(ownerId, taskId) {
  const task = await Task.findOneAndDelete({ _id: taskId, ownerId });
  if (!task) throw notFound('Tâche introuvable');
}

/**
 * Bonus B1 : compteurs du compte connecté.
 * Une tâche est "en retard" si elle a une échéance antérieure à la date de
 * référence et n'est pas terminée.
 */
async function getTaskStats(ownerId, today) {
  const tasks = await Task.find({ ownerId }).select('status priority dueDate').lean();
  const stats = {
    total: tasks.length,
    byStatus: { todo: 0, doing: 0, done: 0 },
    byPriority: { low: 0, medium: 0, high: 0 },
    overdue: 0,
  };
  for (const task of tasks) {
    stats.byStatus[task.status] += 1;
    stats.byPriority[task.priority ?? 'medium'] += 1;
    if (task.dueDate && task.dueDate < today && task.status !== 'done') stats.overdue += 1;
  }
  return stats;
}

/**
 * Bonus B4 : séries hebdomadaires du compte connecté (calcul dans utils/weeklyStats.js).
 * Les tâches terminées avant l'ajout de completedAt n'ont pas cet instant : on retient
 * alors leur dernière modification, seule information disponible.
 */
async function getWeeklyStats(ownerId, options) {
  const tasks = await Task.find({ ownerId }).select('status createdAt completedAt updatedAt').lean();
  const normalized = tasks.map((task) => ({
    status: task.status,
    createdAt: task.createdAt,
    completedAt: task.completedAt ?? (task.status === 'done' ? task.updatedAt : null),
  }));
  return computeWeeklyStats(normalized, options);
}

module.exports = {
  listTasks,
  createTask,
  getTask,
  updateTask,
  deleteTask,
  getTaskStats,
  getWeeklyStats,
  buildListFilter,
};
