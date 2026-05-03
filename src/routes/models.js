const express = require('express');
const { fetchModels } = require('../lib/router');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const data = await fetchModels();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;
