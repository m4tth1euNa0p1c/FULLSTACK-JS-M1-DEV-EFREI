const { Router } = require('express');
const swaggerUi = require('swagger-ui-express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const taskRoutes = require('./task.routes');
const openapi = require('../docs/openapi.json');

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/tasks', taskRoutes);

// Documentation OpenAPI : interface Swagger UI et document brut.
router.get('/docs.json', (req, res) => res.status(200).json(openapi));
router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'TaskFlow API' }));

module.exports = router;
