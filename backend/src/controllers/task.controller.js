const taskService = require('../services/task.service');
const { validateTaskCreate, validateTaskPatch } = require('../validators/task.validator');
const { validateTaskListQuery, validateStatsQuery } = require('../validators/taskQuery.validator');

async function list(req, res) {
  // Bonus B1 : filtres facultatifs (status, priority, due, today). Sans paramètre : toutes les tâches.
  const filters = validateTaskListQuery(req.query);
  const items = await taskService.listTasks(req.user.id, filters);
  res.status(200).json({ items });
}

async function create(req, res) {
  const data = validateTaskCreate(req.body);
  const task = await taskService.createTask(req.user.id, data);
  res.status(201).json(task);
}

async function getOne(req, res) {
  const task = await taskService.getTask(req.user.id, req.params.id);
  res.status(200).json(task);
}

async function update(req, res) {
  const changes = validateTaskPatch(req.body);
  const task = await taskService.updateTask(req.user.id, req.params.id, changes);
  res.status(200).json(task);
}

async function remove(req, res) {
  await taskService.deleteTask(req.user.id, req.params.id);
  res.status(204).end();
}

// Bonus B1 : compteurs du compte connecté.
async function stats(req, res) {
  const { today } = validateStatsQuery(req.query);
  const result = await taskService.getTaskStats(req.user.id, today);
  res.status(200).json(result);
}

module.exports = { list, create, getOne, update, remove, stats };
