const jwt = require("jsonwebtoken");

const PERMISSION_DENIED_STATUS_CODE = 401;
const FailedMessageMap = {
  expired: "Token 已過期",
  invalid: "無效的 token",
  missing: "請先登入",
};

function generateError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function formatVerifyError(jwtError) {
  let result;
  switch (jwtError.name) {
    case "TokenExpiredError":
      result = generateError(
        PERMISSION_DENIED_STATUS_CODE,
        FailedMessageMap.expired
      );
      break;
    default:
      result = generateError(
        PERMISSION_DENIED_STATUS_CODE,
        FailedMessageMap.invalid
      );
      break;
  }
  return result;
}

function verifyJWT(token, secret) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (error, decoded) => {
      if (error) {
        reject(formatVerifyError(error));
      } else {
        resolve(decoded);
      }
    });
  });
}

module.exports = ({ secret, userRepository, logger = console }) => {
  if (!secret || typeof secret !== "string") {
    logger.error("[AuthV2] secret is required and must be a string.");
    throw new Error("[AuthV2] secret is required and must be a string.");
  }
  if (
    !userRepository ||
    typeof userRepository !== "object" ||
    typeof userRepository.findOneBy !== "function"
  ) {
    logger.error("[AuthV2] userRepository is required and must be a function.");
    throw new Error(
      "[AuthV2] userRepository is required and must be a function."
    );
  }
  return async (req, res, next) => {
    if (
      !req.headers ||
      !req.headers.authorization ||
      !req.headers.authorization.startsWith("Bearer")
    ) {
      logger.warn("[AuthV2] Missing authorization header.");
      //請先登入
      next(
        generateError(PERMISSION_DENIED_STATUS_CODE, FailedMessageMap.missing)
      );
      return;
    }
    const [, token] = req.headers.authorization.split(" ");
    if (!token) {
      logger.warn("[AuthV2] Missing token.");
      //404 請先登入
      next(
        generateError(PERMISSION_DENIED_STATUS_CODE, FailedMessageMap.missing)
      );
      return;
    }
    try {
      //驗證 token
      const verifyResult = await verifyJWT(token, secret);
      //在資料庫尋找對應 id 的使用者
      const user = await userRepository.findOneBy({ id: verifyResult.id });
      if (!user) {
        //無效的token
        next(
          generateError(PERMISSION_DENIED_STATUS_CODE, FailedMessageMap.invalid)
        );
        return;
      }
      //在 req 物件加入 user 欄位
      req.user = user;
      next();
    } catch (error) {
      logger.error(`[AuthV2] ${error.message}`);
      next(error);
    }
  };
};
