const { Router } = require('express');

const router = Router();

// Route publique de supervision : corps exact {"status":"ok"}.
router.get('/', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = router;
