const express = require("express");
const router = express.Router();

// Controller
const { auditMediaAssets } = require("../controllers/mediaAssetController");
const { renameS3Files } = require('../utils/AWSUtil');

router.get("/audit", auditMediaAssets);
router.get('/s3rename', renameS3Files);

module.exports = router;
