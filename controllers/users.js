const express = require("express");
const router = express.Router();
const config = require("../config");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("User");
const generateJWT = require("../utils/generateJWT");
const jwtSecret = config.get("secret").jwtSecret;
const {
  isUndefined,
  isNotValidString,
  isTooLong,
  isValidBirthday,
  isNotValidGender,
  isNotValidUrl
} = require("../utils/validUtils");
const bcrypt = require("bcrypt");
const appError = require("../utils/appError");
const { getRepository } = require("typeorm");
const auth = require("../middlewares/auth")({
  secret: jwtSecret,
  userRepository: dataSource.getRepository("Users"),
  logger
});

const passwordPattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,16}/;

//註冊
async function postSignup(req, res, next) {
  try {
    const { username, account, password } = req.body;
    if (
      isUndefined(username) ||
      isNotValidString(username) ||
      isUndefined(account) ||
      isNotValidString(account) ||
      isUndefined(password) ||
      isNotValidString(password)
    ) {
      logger.warn("欄位未填寫正確");
      return next(appError(400, "欄位未填寫正確"));
    }
    // 檢查密碼是否符合規則
    if (!passwordPattern.test(password)) {
      logger.warn("建立使用者錯誤: 密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字");
      return next(appError(400, "密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字"));
    }
    // 檢查是否已經有相同的帳號
    const userRepository = dataSource.getRepository("Users");
    const existingUser = await userRepository.findOne({
      where: { account }
    });

    if (existingUser) {
      logger.warn("建立使用者錯誤: Email 已被使用");
      return next(appError(409, "Email 已被使用"));
    }

    // 加密密碼
    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    // 創建新使用者
    const newUser = userRepository.create({
      username,
      account,
      hashed_password: hashPassword,
      role: { id: 1 } // 預設為 sponsor
    });

    // 儲存新使用者
    const savedUser = await userRepository.save(newUser);
    logger.info("新建立的使用者ID:", savedUser.id);

    // 回應成功
    res.status(201).json({
      status: "true",
      message: "註冊成功",
      data: {
        user: {
          id: savedUser.id,
          username: savedUser.username
        }
      }
    });
  } catch (error) {
    logger.error("建立使用者錯誤:", error);
    next(error); // 交由錯誤處理中間件處理
  }
}

//登入
async function postLogin(req, res, next) {
  try {
    const { account, password } = req.body;
    if (
      isUndefined(account) ||
      isNotValidString(account) ||
      isUndefined(password) ||
      isNotValidString(password)
    ) {
      logger.warn("欄位填寫不完整或有誤");
      return next(appError(400, "欄位填寫不完整或有誤"));
    }
    if (!passwordPattern.test(password)) {
      logger.warn("密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字");
      return next(appError(400, "密碼不符合規則，需要包含英文數字大小寫，最短8個字，最長16個字"));
    }

    const userRepository = dataSource.getRepository("Users");
    const existingUser = await userRepository.findOne({
      select: ["id", "username", "hashed_password", "role"],
      where: { account },
      relations: ["role"]
    });

    if (!existingUser) {
      return next(appError(400, "使用者不存在或密碼輸入錯誤"));
    }
    logger.info(`使用者資料: ${JSON.stringify(existingUser)}`);
    const isMatch = await bcrypt.compare(password, existingUser.hashed_password);
    if (!isMatch) {
      return next(appError(400, "使用者不存在密碼輸入錯誤"));
    }

    const token = await generateJWT(
      {
        id: existingUser.id,
        role_id: existingUser.role.id,
        role: existingUser.role.role
      },
      { expiresIn: "15m" }
    );

    res.status(200).json({
      status: "true",
      data: {
        token,
        users: {
          id: existingUser.id,
          account: existingUser.account,
          username: existingUser.username,
          avatar_url: existingUser.avatar_url,
          role: {
            id: existingUser.role.id,
            role_type: existingUser.role.role_type
          }
        }
      }
    });
  } catch (error) {
    logger.error("登入失敗", error);
    next(error);
  }
}

//驗證登入狀態
async function postStatus(req, res, next) {
  try {
    // 檢查 auth middleware 是否有把 user 加到 req
    if (!req.user) {
      return next(appError(401, "請先登入"));
    }

    const { id, account, username, avatar_url, role } = req.user;

    res.status(200).json({
      status: true,
      user: {
        id,
        account,
        username,
        avatar_url,
        role
      },
      message: "使用者目前已登入"
    });
  } catch (error) {
    logger.error("未登入或登入狀態逾期", error);
    next(error);
  }
}

//查詢會員資料
async function getProfile(req, res, next) {
  try {
    //檢查是否有登入
    if (!req.user || !req.user.id) {
      return next(appError(401, "請先登入"));
    }
    //從 DB 查詢完整的會員資料
    const userRepository = dataSource.getRepository("Users");
    const user = await userRepository.findOne({
      where: { id: req.user.id },
      relations: ["gender"]
    });

    if (!user) {
      return next(appError(404, "查無此會員"));
    }
    //回傳資料
    res.status(200).json({
      status: true,
      message: "查詢成功",
      user: {
        id: user.id,
        account: user.account,
        username: user.username,
        phone: user.phone,
        avatar_url: user.avatar_url,
        birthday: user.birthday,
        gender: user.gender
      }
    });
  } catch (error) {
    logger.error("查詢會員資料失敗", error);
    next(error);
  }
}

// 修改會員資料
async function patchProfile(req, res, next) {
  const { username, phone, avatar_url, birthday, gender } = req.body;
  try {
    if (!req.user || !req.user.id) {
      return next(appError(401, "未授權，Token無效"));
    }
    const cleanedAvatar = avatar_url ? avatar_url.trim() : null;
    if (
      isNotValidString(username) ||
      isTooLong(username, 50) ||
      isNotValidString(phone) ||
      isTooLong(phone, 20) ||
      (cleanedAvatar && (isNotValidUrl(avatar_url) || isTooLong(avatar_url, 2083))) ||
      (birthday && !isValidBirthday(birthday)) ||
      (gender && ![1, 2, 3, 4].includes(Number(gender)))
    ) {
      return next(appError(400, "格式錯誤"));
    }
    const user_id = req.user.id;
    const userRepository = dataSource.getRepository("Users");
    const genderRepository = dataSource.getRepository("Genders");

    const user = await userRepository.findOne({
      where: { id: req.user.id },
      relations: ["gender"]
    });
    if (!user) {
      return next(appError(401, "未授權，Token無效"));
    }
    // 驗證 gender id 是否正確
    let genderEntity = null;
    if (gender) {
      genderEntity = await genderRepository.findOne({ where: { id: gender } });
      if (!genderEntity) {
        return next(appError(400, "無效的性別選項"));
      }
    }
    user.username = username;
    user.phone = phone;
    user.avatar_url = avatar_url || user.avatar_url;
    user.birthday = birthday || user.birthday;
    user.gender = genderEntity;

    await userRepository.save(user);

    res.status(200).json({
      status: true,
      message: "修改成功",
      data: {
        user: {
          userId: user.userId,
          username: user.username,
          phone: user.phone,
          avatar_url: user.avatar_url,
          birthday: user.birthday,
          gender: user.gender
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  postSignup,
  postLogin,
  postStatus,
  getProfile,
  patchProfile
};
