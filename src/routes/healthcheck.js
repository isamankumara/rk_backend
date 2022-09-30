const express = require('express');
const router = express.Router();

// Controller
const { healthcheck } = require('../controllers/healthcheckController');
router.get('/health', (req, res) => {
    res.status(200).send('Ok');
  });
// Validation

//@router GET api/question
//@desc GET all questions
router.get("/", healthcheck);

module.exports = router;