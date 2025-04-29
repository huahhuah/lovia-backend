const express = require('express');
const router = express.Router();
const config = require('../config');

const generateJWT = require('../utils/generateJWT');
const { dataSource } = require('../db/data-source');
const logger = require('../utils/logger')('User');
const { isNotValidSting, isValidBirthday, isNotValidGender, isNotValidUrl, isTooLong} = require('../utils/validUtils')
const auth = require('../middlewares/auth')({
    secret: config.get('secret').jwtSecret,
    userRepository: dataSource.getRepository('User'),
    logger
})

router.patch('/v1/users/profile', auth, async(req, res, next) =>{
    const {username, phone, avatar_url, birthday, gender} = req.body;
    if(isNotValidSting(username) || isTooLong(username,50) || 
        isNotValidSting(phone) || isTooLong(phone, 20) ||
        (avatar_url && (isNotValidUrl(avatar_url) || isTooLong(avatar_url, 2083)))  ||
        (birthday && !isValidBirthday(birthday)) ||
        (gender && isNotValidGender(gender))){
        res.status(400).json({
            status: false,
            message: '格式錯誤'
        });
    }
    try {
        const user_id = req.user.user_id;
        const userRepository = dataSource.getRepository('User');
        const user =  await userRepository.findOne({where:{user_id}});
        if(!user){
            res.status(401).json({
                status: false,
                message: '未授權，Token 無效'
            });
        }
        user.username = username;
        user.phone = phone;
        user.avatar_url = avatar_url || user.avatar_url; 
        user.birthday = birthday || user.birthday;
        user.gender = gender || user.gender;
        await userRepository.save(user);
        res.status(200).json({
            status: true,
            message: '修改成功',
            data: {
                user: {
                  userId: user.userId,
                  username: user.username,
                  phone: user.phone,
                  avatar_url: user.avatar_url,
                  birthday: user.birthday,
                  gender: user.gender,
                },
            },
        });
    } catch(error){
        next(error);
    }
})

module.exports = router;