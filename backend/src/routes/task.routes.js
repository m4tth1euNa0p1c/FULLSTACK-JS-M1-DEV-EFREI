const { Router } = require('express');
const taskController = require('../controllers/task.controller');
const requireAuth = require('../middlewares/requireAuth');
const validateObjectId = require('../middlewares/validateObjectId');

const router = Router();

// Toutes les routes métier exigent un JWT valide.
router.use(requireAuth);

router.get('/', taskController.list);
router.post('/', taskController.create);
// Bonus B1 et B4 : déclarées avant "/:id", sinon "stats" serait pris pour un identifiant malformé.
router.get('/stats', taskController.stats);
router.get('/stats/weekly', taskController.weeklyStats);
router.get('/:id', validateObjectId('id'), taskController.getOne);
router.patch('/:id', validateObjectId('id'), taskController.update);
router.delete('/:id', validateObjectId('id'), taskController.remove);

module.exports = router;
