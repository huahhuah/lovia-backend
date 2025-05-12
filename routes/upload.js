const express = require('express');
const multer = require('multer');
const uploadImg = require('../services/uploadImg');
const router = express.Router();

const upload = multer();
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

router.post('/image', upload.single('file'), async (req, res) =>{
    const imageBuffer = req.file?.buffer;
    try {
        const result = await uploadImg(req.file.buffer, IMGBB_API_KEY);
        res.json({
            status: 'success',
            message: '圖片上傳成功',
            url: result.url,
            type: req.body.type,
            filename: result.title || result.id,
            size_kb: (req.file.size/1024).toFixed(1),
        });
    } catch (err){
        console.error('圖片上傳錯誤:', err.message);  // 更詳細的錯誤消息
        res.status(500).json({ status: 'error', message: err.message || '上傳失敗' });
    }
});

module.exports = router;