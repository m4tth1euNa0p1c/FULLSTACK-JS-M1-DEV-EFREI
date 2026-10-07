const taskService = require('../services/task.service');
const { validateTaskCreate, validateTaskPatch } = require('../validators/task.validator');

async function list(req, res) {
  const items = await taskService.listTasks(req.user.id);
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

module.exports = { list, create, getOne, update, remove };
