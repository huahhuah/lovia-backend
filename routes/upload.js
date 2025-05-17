const express = require("express");
const multer = require("multer");
const uploadImg = require("../services/uploadImg");
const appError = require("../utils/appError");
const router = express.Router();
const logger = require("../utils/logger")("UploadRoute");

const upload = multer({
  storage: multer.memoryStorage(),
  // 限制上傳檔案最大為2MB
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

router.post("/image", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file?.buffer) {
      return next(appError(400, "未上傳檔案"));
    }
    console.log(req.file); // 確認你有拿到檔案
    const result = await uploadImg(req.file.buffer, IMGBB_API_KEY);
    res.json({
      status: "success",
      message: "圖片上傳成功",
      url: result.url,
      type: req.body.type,
      filename: result.title || result.id,
      size_kb: (req.file.size / 1024).toFixed(1)
    });
  } catch (error) {
    logger.error("上傳失敗", error);
    if (error.code === "LIMIT_FILE_SIZE") {
      return next(appError(400, "檔案大小不能超過 2MB"));
    }
    next(error);
  }
});

module.exports = router;
