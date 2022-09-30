const express = require("express");
const router = express.Router();

const { imageUpload } = require("./../controllers/fileUploadController");

// @route api/upload
// @desc Upload image


router.post('/profileimage', imageUpload.single('file'), async (req, res) => {
  if (req.file) {
    // await res.send(req.file.location);
    // need to send back just the media asset id, not the 'media' prefix
    const mediaAssetId = req.file.key.split('/')[1];
    await res.send(mediaAssetId);
  } else {
    res.send();
  }
});

module.exports = router;