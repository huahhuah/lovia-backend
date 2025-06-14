const jwt = require("jsonwebtoken");
const appError = require("../utils/appError");

function authMiddleware({ secret, userRepository, logger }) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return next(appError(401, "未提供 token"));

    try {
      const decoded = jwt.verify(token, secret);
      const user = await userRepository.findOne({ where: { id: decoded.id }, relations: ["role"] });
      if (!user) return next(appError(401, "找不到使用者"));

      req.user = {
        id: user.id,
        account: user.account,
        username: user.username,
        avatar_url: user.avatar_url,
        role: {
          id: user.role.id,
          role_type: user.role.role_type
        }
      };

      next();
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(appError(401, "Token 已過期"));
      }
      return next(appError(401, "Token 驗證失敗"));
    }
  };
}

module.exports = authMiddleware;
