const { handleLinePayRequest } = require("./linePay");
const { createEcpayPayment } = require("./ecpay");
const appError = require("../utils/appError");
const { dataSource } = require("../db/data-source");
const Sponsorships = require("../entities/Sponsorships");

async function createPaymentRequest(req, res, next) {
  const { amount, email, payment_type } = req.body;
  const { orderId } = req.params;

  const supportedTypes = ["linepay", "credit", "atm"];
  const sponsorshipRepo = dataSource.getRepository("Sponsorships");

  if (!order_id) {
    return next(appError(400, "缺少訂單 ID"));
  }

  if (!payment_type) {
    return next(appError(400, "缺少付款方式"));
  }

  const normalizedType = payment_type === "card" ? "credit" : payment_type?.toLowerCase();

  if (!supportedTypes.includes(normalizedType)) {
    return next(appError(400, `不支援的付款方式：${payment_type}`));
  }

  // 檢查是否已存在該訂單（避免重複建立付款）
  const existing = await sponsorshipRepo.findOne({ where: { order_uuid: order_id } });
  if (!existing) {
    return next(appError(404, "查無此訂單"));
  }

  if (existing.payment_status === "paid") {
    return next(appError(400, "此訂單已完成付款，請勿重複操作"));
  }

  // 將 order_id 合併進 body 傳入原 controller
  req.params.orderId = order_id;

  if (normalizedType === "linepay") {
    return handleLinePayRequest(req, res, next);
  }

  if (normalizedType === "credit" || normalizedType === "atm") {
    return createEcpayPayment(req, res, next);
  }

  return next(appError(400, "付款類型處理失敗"));
}

async function getPaymentSuccessInfo(req, res, next) {
  try {
    const orderId = req.params.order_id || req.params.orderId;
    const sponsorshipRepo = dataSource.getRepository("Sponsorships");

    const sponsorship = await sponsorshipRepo.findOne({
      where: { order_uuid: orderId },
      relations: ["user", "shipping", "invoice", "invoice.type"]
    });

    if (!sponsorship) {
      return next(appError(404, "找不到訂單資料"));
    }

    if (sponsorship.status !== "paid") {
      return next(appError(400, "此訂單尚未完成付款"));
    }

    const response = {
      orderId: sponsorship.order_uuid,
      transactionId: sponsorship.transaction_id,
      amount: sponsorship.amount,
      paidAt: sponsorship.paid_at,
      paymentMethod: sponsorship.payment_method,
      display_name: sponsorship.display_name,
      email: sponsorship.user?.account || "",
      recipient: sponsorship.shipping?.name || "",
      phone: sponsorship.shipping?.phone || "",
      address: sponsorship.shipping?.address || "",
      note: sponsorship.shipping?.note || "",
      status: sponsorship.status,
      bank_code: sponsorship.bank_code || "",
      v_account: sponsorship.v_account || "",
      expire_date: sponsorship.expire_date || ""
    };

    return res.status(200).json({
      status: true,
      message: "付款資料載入成功",
      data: response
    });
  } catch (err) {
    console.error("取得付款成功資料失敗:", err.stack || err);
    return next(appError(500, err.message || "伺服器錯誤"));
  }
}

async function getMySponsorships(req, res) {
  try {
    const userId = req.user?.id;

    // 參數驗證
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "用戶未授權"
      });
    }

    console.log("正在查詢用戶贊助紀錄:", userId);

    const sponsorshipRepo = dataSource.getRepository(Sponsorships);

    // 添加分頁和查詢選項
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 允許前端指定需要的關聯資料
    const includeRelations = req.query.include
      ? req.query.include
          .split(",")
          .filter(rel => ["project", "plan", "shipping", "invoice"].includes(rel))
      : ["project", "plan"];

    // 使用 QueryBuilder 提供更好的查詢控制
    const queryBuilder = sponsorshipRepo
      .createQueryBuilder("sponsorship")
      .where("sponsorship.user_id = :userId", { userId })
      .andWhere("sponsorship.status = :status", { status: "paid" })
      .orderBy("sponsorship.created_at", "DESC")
      .skip(skip)
      .take(limit);

    // 動態載入關聯資料
    includeRelations.forEach(relation => {
      queryBuilder.leftJoinAndSelect(`sponsorship.${relation}`, relation);
    });

    // 同時查詢總數和資料
    const [sponsorships, total] = await Promise.all([
      queryBuilder.getMany(),
      sponsorshipRepo.count({
        where: { user: { id: userId }, status: "paid" }
      })
    ]);

    console.log(`查詢到 ${sponsorships.length} 筆贊助紀錄`);

    // 資料轉換和清理（移除敏感資訊）
    const sanitizedSponsorships = sponsorships.map(sponsorship => ({
      id: sponsorship.id,
      amount: sponsorship.amount,
      status: sponsorship.status,
      created_at: sponsorship.created_at,
      updated_at: sponsorship.updated_at,
      project: sponsorship.project
        ? {
            id: sponsorship.project.id,
            title: sponsorship.project.title,
            image: sponsorship.project.image,
            status: sponsorship.project.status
          }
        : null,
      plan: sponsorship.plan
        ? {
            id: sponsorship.plan.id,
            title: sponsorship.plan.title,
            price: sponsorship.plan.price,
            description: sponsorship.plan.description
          }
        : null,
      shipping: sponsorship.shipping || null,
      invoice: sponsorship.invoice
        ? {
            id: sponsorship.invoice.id,
            invoice_number: sponsorship.invoice.invoice_number,
            created_at: sponsorship.invoice.created_at
          }
        : null
    }));

    return res.json({
      success: true,
      data: sanitizedSponsorships,
      pagination: {
        current_page: page,
        per_page: limit,
        total: total,
        total_pages: Math.ceil(total / limit),
        has_more: skip + sponsorships.length < total
      },
      meta: {
        count: sponsorships.length,
        total: total
      }
    });
  } catch (error) {
    console.error("取得我的贊助紀錄失敗:", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });

    // 根據錯誤類型返回不同的狀態碼
    if (error.name === "QueryFailedError") {
      return res.status(500).json({
        success: false,
        message: "資料庫查詢失敗"
      });
    }

    return res.status(500).json({
      success: false,
      message: "取得我的贊助紀錄失敗"
    });
  }
}

// 額外的輔助函數用於複雜查詢
async function getMySponsorshipsWithFilters(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "用戶未授權"
      });
    }

    const {
      page = 1,
      limit = 10,
      status = "paid",
      project_id,
      start_date,
      end_date,
      min_amount,
      max_amount,
      sort_by = "created_at",
      sort_order = "DESC"
    } = req.query;

    const sponsorshipRepo = dataSource.getRepository(Sponsorships);
    const queryBuilder = sponsorshipRepo
      .createQueryBuilder("sponsorship")
      .leftJoinAndSelect("sponsorship.project", "project")
      .leftJoinAndSelect("sponsorship.plan", "plan")
      .where("sponsorship.user_id = :userId", { userId });

    // 動態添加篩選條件
    if (status) {
      queryBuilder.andWhere("sponsorship.status = :status", { status });
    }

    if (project_id) {
      queryBuilder.andWhere("sponsorship.project_id = :project_id", { project_id });
    }

    if (start_date) {
      queryBuilder.andWhere("sponsorship.created_at >= :start_date", { start_date });
    }

    if (end_date) {
      queryBuilder.andWhere("sponsorship.created_at <= :end_date", { end_date });
    }

    if (min_amount) {
      queryBuilder.andWhere("sponsorship.amount >= :min_amount", { min_amount });
    }

    if (max_amount) {
      queryBuilder.andWhere("sponsorship.amount <= :max_amount", { max_amount });
    }

    // 排序和分頁
    const validSortFields = ["created_at", "amount", "updated_at"];
    const sortField = validSortFields.includes(sort_by) ? sort_by : "created_at";
    const order = ["ASC", "DESC"].includes(sort_order.toUpperCase())
      ? sort_order.toUpperCase()
      : "DESC";

    queryBuilder
      .orderBy(`sponsorship.${sortField}`, order)
      .skip((page - 1) * limit)
      .take(limit);

    const [sponsorships, total] = await queryBuilder.getManyAndCount();

    return res.json({
      success: true,
      data: sponsorships,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: total,
        total_pages: Math.ceil(total / limit)
      },
      filters: {
        status,
        project_id,
        start_date,
        end_date,
        min_amount,
        max_amount,
        sort_by: sortField,
        sort_order: order
      }
    });
  } catch (error) {
    console.error("取得篩選後的贊助紀錄失敗:", error);
    return res.status(500).json({
      success: false,
      message: "取得贊助紀錄失敗"
    });
  }
}

module.exports = {
  createPaymentRequest,
  getPaymentSuccessInfo,
  getMySponsorships,
  getMySponsorshipsWithFilters
};
