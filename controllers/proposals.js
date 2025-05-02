const { appError } = require("../utils/appError");
const logger = require("../utils/logger")("ProposalController");
const { isNotValidString, isTooLong } = require("../utils/validUtils");

function isValidImage(url) {
    return typeof url === "string" && (url.endsWith(".jpg") || url.endsWith(".png"));
  }
  
  function isValidDate(dateStr) {
    return !isNaN(Date.parse(dateStr));
  }
  
  async function createProposal(req, res, next) {
    try {
      const {
        title,
        summary,
        category,
        total_amount,
        start_time,
        end_time,
        cover,
        full_content,
        project_team,
        faq,
        plan_name,
        amount,
        quantity,
        feedback,
        feedback_img,
        delivery_date,
      } = req.body;
  
      // ✅ 必填欄位檢查 + 格式驗證
      if (
        !title || isTooLong(title, 80) ||
        !summary || isTooLong(summary, 200) ||
        !category || typeof category !== "string" ||
        !plan_name || isTooLong(plan_name, 80) ||
        !full_content || typeof full_content !== "string" ||
        !project_team || typeof project_team !== "string" ||
        !feedback || typeof feedback !== "string" ||
        !cover || !isValidImage(cover) ||
        !total_amount || typeof total_amount !== "number" ||
        !amount || typeof amount !== "number" ||
        !start_time || !isValidDate(start_time) ||
        !end_time || !isValidDate(end_time) ||
        !delivery_date || !isValidDate(delivery_date)
      ) {
        logger.warn("建立提案資料格式錯誤");
        return next(appError(400, "欄位格式錯誤或缺少必要欄位"));
      }
  
      // ✅ 非必填欄位格式驗證
      if (
        (faq && typeof faq !== "string") ||
        (quantity && typeof quantity !== "number") ||
        (feedback_img && !isValidImage(feedback_img))
      ) {
        logger.warn("非必填欄位格式錯誤");
        return next(appError(400, "欄位格式錯誤"));
      }
  
      // ✅ 建立資料
      const proposalRepository = req.dataSource.getRepository("Proposal");
      const newProposal = proposalRepository.create(req.body);
      const savedProposal = await proposalRepository.save(newProposal);
  
      // 回傳儲存的資料，包含自動生成的 `id`
      res.status(200).json({
        status: "success",
        data: {
          id: savedProposal.id,  // 傳回 id 欄位
          ...savedProposal,  // 其他欄位
        },
      });
    } catch (err) {
      console.error("🔥 建立提案失敗詳細錯誤：", err);
      logger.error("建立提案失敗", err);
      res.status(500).json({
        status: "error",
        message: err.message || "建立提案失敗",
      });
    }
  }
  
  module.exports = {
    createProposal,
  };