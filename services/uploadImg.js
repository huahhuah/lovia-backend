// 對Imgbb溝通的邏輯
// upload to imgbb
const axios = require ('axios');
const FormData = require('form-data');
const imageType = require('image-type'); // 判斷圖片格式
const appError = require('../utils/appError');

async function uploadImg(imageBuffer, apiKey) {
    try {
        // 使用image-type
        const type = imageType(imageBuffer);
        if (!type || (type.mime !== 'image/jpeg' && type.mime !== 'image/png')) {
            throw appError(400, '只接受 JPG 或 PNG 格式的圖片');
        }
        const filename = `image.${type.ext}`;
        const contentType = type.mime;
        // 建立FormData 把圖片數據加進來
        const form = new FormData();
        form.append('key', apiKey);
        form.append('image', imageBuffer, {
            filename: filename,
            contentType: contentType,
        });

        // 發POST 到ImgBB 的API
        const res = await axios.post('https://api.imgbb.com/1/upload', form, {
            headers: {
                ...form.getHeaders(),
            },
        });
        // 返回上傳的圖片資料
        return res.data.data;
    } catch (error) {
        if(error.response){
            throw appError(500, `ImgBB API問題 ${error.response.data.message}`)
        }else{
            throw appError(400, error.message || '圖片上傳失敗')
        }
    }
}
module.exports = uploadImg;