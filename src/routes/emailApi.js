const express = require('express');
const router = express.Router();

// Controller
const { generalInquiry } = require('../controllers/emailApi');

// @router GET api/chapter
// @desc GET all chapters
router.post('/general-inquiry', generalInquiry);

module.exports = router;