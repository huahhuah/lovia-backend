const jwt = require("jsonwebtoken");

const PERMISSION_DENIED = 401;
const FailedMessageMap = {
  expired: "Token 已過期",
  invalid: "無效的 token",
  missing: "請先登入"
};

function generateError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function formatVerifyError(error) {
  if (error.name === "TokenExpiredError") {
    return generateError(PERMISSION_DENIED, FailedMessageMap.expired);
  }
  return generateError(PERMISSION_DENIED, FailedMessageMap.invalid);
}

function verifyJWT(token, secret) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) return reject(formatVerifyError(err));
      resolve(decoded);
    });
  });
}

module.exports = ({ secret, userRepository, logger = console }) => {
  if (!secret || typeof secret !== "string") {
    logger.error("[Auth] secret 必須是 string");
    throw new Error("[Auth] secret 必須是 string");
  }

  if (!userRepository || typeof userRepository.findOne !== "function") {
    logger.error("[Auth] userRepository.findOne 必須是 function");
    throw new Error("[Auth] userRepository.findOne 必須是 function");
  }

  return async (req, res, next) => {
    const authHeader = req.headers?.authorization || "";

    if (!authHeader.startsWith("Bearer")) {
      logger.warn("[Auth] Authorization header 不存在或格式錯誤");
      return next(generateError(PERMISSION_DENIED, FailedMessageMap.missing));
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      logger.warn("[Auth] 未提供 token");
      return next(generateError(PERMISSION_DENIED, FailedMessageMap.missing));
    }

    try {
      const decoded = await verifyJWT(token, secret);

      // ✅ 改用 findOne + relations 取得 role 資訊
      const user = await userRepository.findOne({
        where: { id: decoded.id },
        relations: ["role"]
      });

      if (!user) {
        logger.warn("[Auth] 無效的使用者 ID");
        return next(generateError(PERMISSION_DENIED, FailedMessageMap.invalid));
      }

      // ✅ 組裝 req.user，提供 avatar_url 與 role_type 給前端用
      req.user = {
        id: user.id,
        account: user.account,
        username: user.username,
        avatar_url: user.avatar_url,
        role_id: user.role_id,
        role: {
          id: user.role.id,
          role_type: user.role.role_type
        }
      };

      next();
    } catch (error) {
      logger.error(`[Auth] ${error.message}`);
      next(error);
    }
  };
};
