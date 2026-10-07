const Task = require('../models/Task');
const { notFound } = require('../utils/errors');

/**
 * Toutes les requêtes filtrent sur ownerId : une tâche qui n'appartient pas
 * à l'utilisateur est indiscernable d'une tâche inexistante (404 dans les deux cas).
 * ownerId vient de req.user.id, donc du JWT vérifié, jamais du client.
 */

async function listTasks(ownerId) {
  const tasks = await Task.find({ ownerId }).sort({ createdAt: -1 });
  return tasks.map((task) => task.toJSON());
}

async function createTask(ownerId, data) {
  const task = await Task.create({ ...data, ownerId });
  return task.toJSON();
}

async function getTask(ownerId, taskId) {
  const task = await Task.findOne({ _id: taskId, ownerId });
  if (!task) throw notFound('Tâche introuvable');
  return task.toJSON();
}

async function updateTask(ownerId, taskId, changes) {
  const task = await Task.findOneAndUpdate(
    { _id: taskId, ownerId },
    { $set: changes },
    { returnDocument: 'after', runValidators: true },
  );
  if (!task) throw notFound('Tâche introuvable');
  return task.toJSON();
}

async function deleteTask(ownerId, taskId) {
  const task = await Task.findOneAndDelete({ _id: taskId, ownerId });
  if (!task) throw notFound('Tâche introuvable');
}

module.exports = { listTasks, createTask, getTask, updateTask, deleteTask };
