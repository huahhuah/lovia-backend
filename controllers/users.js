const bcrypt = require("bcrypt");
const { IsNull, In } = require("typeorm");

const config = require("../config/index");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("UsersController");
const generateJWT = require("../utils/generateJWT");
const jwtSecret = config.get("secret").jwtSecret;
const { isUndefined, isNotValidString } = require("../utils/validUtils");
const appError = require("../utils/appError");

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
          username: existingUser.username
        }
      }
    });
  } catch (error) {
    logger.error("登入失敗", error);
    next(error);
  }
}

async function postStatus(req, res, next) {
  try {
    // 檢查 auth middleware 是否有把 user 加到 req
    if (!req.user) {
      return next(appError(401, "請先登入"));
    }

    const { id, account, username, role } = req.user;

    res.status(200).json({
      status: true,
      user: {
        id,
        account,
        username,
        role
      },
      message: "使用者目前已登入"
    });
  } catch (error) {
    logger.error("未登入或登入狀態逾期", error);
    next(error);
  }
}

module.exports = {
  postSignup,
  postLogin,
  postStatus
};
