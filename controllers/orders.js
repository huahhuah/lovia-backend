// orders.controller.js
// 統一處理付款流程：整合 LINE Pay / 綠界金流

const { handleLinePayRequest } = require("./linePay");
const { createEcpayPayment } = require("./ecpay");
const appError = require("../utils/appError");
const { dataSource } = require("../db/data-source");
const Sponsorships = require("../entities/Sponsorships");

// 建立付款請求（統一入口）
async function createPaymentRequest(req, res, next) {
  try {
    const { payment_type, productName } = req.body;
    const { orderId } = req.params;
    const userId = req.user?.id;

    if (!orderId) return next(appError(400, "缺少訂單 ID"));
    if (!payment_type) return next(appError(400, "缺少付款方式"));
    if (!userId) return next(appError(401, "請先登入"));

    const normalizedType = payment_type === "card" ? "credit" : payment_type?.toLowerCase();
    const supportedTypes = ["linepay", "credit", "atm"];
    if (!supportedTypes.includes(normalizedType)) {
      return next(appError(400, `不支援的付款方式: ${normalizedType}`));
    }

    const sponsorshipRepo = dataSource.getRepository(Sponsorships);
    const order = await sponsorshipRepo.findOne({
      where: { order_uuid: orderId },
      relations: ["user", "plan"]
    });

    if (!order) return next(appError(404, "找不到該訂單"));
    if (order.user.id !== userId) return next(appError(403, "無權操作此訂單"));
    if (order.status === "paid") return next(appError(400, "訂單已付款"));

    const amount = order.amount;
    const email = order.email || order.user.email;

    //  分流處理
    if (normalizedType === "linepay") {
      const result = await handleLinePayRequest({
        orderId,
        amount,
        email,
        productName: productName || order.plan?.plan_name || "贊助專案",
        sponsorship: order,
        userId
      });
      return res.status(200).json({
        status: true,
        message: "LINE Pay 建立成功",
        data: result
      });
    }

    if (["credit", "atm"].includes(normalizedType)) {
      return await createEcpayPayment(req, res); // controller 內已直接處理 response
    }

    return next(appError(400, "未實作該付款方式"));
  } catch (err) {
    console.error("createPaymentRequest 發生錯誤：", err);
    return next(appError(500, "建立付款請求失敗"));
  }
}

// 取得付款成功後的資訊顯示
async function getPaymentSuccessInfo(req, res, next) {
  try {
    const { orderId } = req.params;
    const { transactionId } = req.body;
    const token = req.headers.authorization?.replace("Bearer ", "") || req.query.token;

    if (!orderId || !token) {
      return next(appError(400, "缺少必要參數"));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      return next(appError(401, "無效的 token"));
    }

    const sponsorshipRepo = dataSource.getRepository(Sponsorships);

    const sponsorship = await sponsorshipRepo.findOne({
      where: { order_uuid: orderId },
      relations: ["user", "invoice", "shipping"]
    });

    if (!sponsorship) return next(appError(404, "找不到訂單"));

    if (sponsorship.user.id !== decoded.id) {
      return next(appError(403, "無權限讀取該筆贊助資料"));
    }

    return res.json({
      status: "success",
      data: {
        transactionId: sponsorship.transaction_id,
        amount: sponsorship.amount,
        paidAt: sponsorship.paid_at,
        paymentMethod: sponsorship.payment_method,
        status: sponsorship.status,
        display_name: sponsorship.display_name,
        email: sponsorship.user.email,
        recipient: sponsorship.shipping?.recipient,
        phone: sponsorship.shipping?.phone,
        address: sponsorship.shipping?.address,
        note: sponsorship.note
      }
    });
  } catch (err) {
    next(err);
  }
}

// 取得用戶自己的所有已付款贊助
async function getMySponsorships(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "用戶未授權" });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const includeRelations = req.query.include
      ? req.query.include
          .split(",")
          .filter(rel => ["project", "plan", "shipping", "invoice"].includes(rel))
      : ["project", "plan"];

    const repo = dataSource.getRepository(Sponsorships);
    const queryBuilder = repo
      .createQueryBuilder("sponsorship")
      .where("sponsorship.user_id = :userId", { userId })
      .andWhere("sponsorship.status = :status", { status: "paid" })
      .orderBy("sponsorship.created_at", "DESC")
      .skip(skip)
      .take(limit);

    includeRelations.forEach(relation => {
      queryBuilder.leftJoinAndSelect(`sponsorship.${relation}`, relation);
    });

    const [sponsorships, total] = await Promise.all([
      queryBuilder.getMany(),
      repo.count({ where: { user: { id: userId }, status: "paid" } })
    ]);

    const sanitized = sponsorships.map(s => ({
      id: s.id,
      order_uuid: s.order_uuid,
      transaction_id: s.transaction_id,
      amount: s.amount,
      status: s.status,
      payment_method: s.payment_method,
      created_at: s.created_at,
      updated_at: s.updated_at,
      project: s.project
        ? {
            id: s.project.id,
            title: s.project.title,
            image: s.project.image,
            status: s.project.status
          }
        : null,
      plan: s.plan
        ? {
            id: s.plan.id,
            plan_name: s.plan.plan_name,
            amount: s.plan.amount,
            description: s.plan.description
          }
        : null,
      shipping: s.shipping || null,
      invoice: s.invoice
        ? {
            id: s.invoice.id,
            invoice_number: s.invoice.invoice_number,
            created_at: s.invoice.created_at
          }
        : null
    }));

    return res.json({
      success: true,
      data: sanitized,
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
    console.error("取得我的贊助紀錄失敗:", error);
    return res.status(500).json({ success: false, message: "取得贊助紀錄失敗" });
  }
}

// 無需登入，查詢付款成功資訊（公開版本）
async function getPublicPaymentResult(req, res) {
  const { orderId } = req.params;
  const { transactionId } = req.body;

  if (!orderId) return res.status(400).json({ success: false, message: "缺少訂單 ID" });

  try {
    const repo = dataSource.getRepository("Sponsorships");
    const order = await repo.findOne({
      where: { order_uuid: orderId },
      relations: ["user", "invoice", "project", "shipping", "invoice.type"]
    });

    if (!order) return res.status(404).json({ success: false, message: "找不到訂單" });

    return res.json({
      success: true,
      data: {
        orderId: order.order_uuid,
        transactionId: order.transaction_id,
        amount: order.amount,
        paidAt: order.paid_at,
        paymentMethod: order.payment_method,
        status: order.status,
        // 贊助者資訊
        display_name: order.display_name || order.user?.name || "匿名",
        email: order.user?.account || "",
        // 收件人資訊
        recipient: order.shipping?.name || "",
        phone: order.shipping?.phone || "",
        address: order.shipping?.address || "",
        note: order.note,
        // ATM 付款資訊
        bank_code: order.bank_code || "",
        v_account: order.v_account || "",
        expire_date: order.expire_date || "",

        //發票資訊
        invoice_type: order.invoice?.type?.name || "", //發票類型（如：捐贈、個人、公司）
        donate_name: order.invoice?.donate_name || "", // 發票開立對象（若有填寫）
        mobile_barcode: order.invoice?.mobile_barcode || "", // 手機條碼
        company_uniform_number: order.invoice?.uniform_number || "" // 公司統編
      }
    });
  } catch (err) {
    console.error("查詢公開付款結果失敗：", err);
    return res.status(500).json({ success: false, message: "系統錯誤" });
  }
}

module.exports = {
  createPaymentRequest,
  getPaymentSuccessInfo,
  getMySponsorships,
  getPublicPaymentResult
};
