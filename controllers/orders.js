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

    const typeMap = {
      card: "credit",
      credit: "credit",
      webatm: "webatm",
      linepay: "linepay"
    };
    const normalizedType = typeMap[payment_type?.toLowerCase()] || null;

    if (!normalizedType) {
      console.warn("⚠️ 不支援付款方式:", payment_type);
      return next(appError(400, `不支援的付款方式: ${payment_type}`));
    }

    const sponsorshipRepo = dataSource.getRepository(Sponsorships);
    const order = await sponsorshipRepo.findOne({
      where: { order_uuid: orderId },
      relations: ["user", "plan"]
    });

    if (!order) {
      console.error(" 找不到訂單:", orderId);
      return next(appError(404, "找不到該訂單"));
    }

    if (order.user.id !== userId) {
      console.warn(" 訂單使用者不符：", order.user.id, userId);
      return next(appError(403, "無權操作此訂單"));
    }

    if (order.status === "paid") {
      console.info(" 訂單已付款：", orderId);
      return next(appError(400, "訂單已付款"));
    }

    const amount = Number(order.amount);
    const email = order.user?.email?.trim() || order.user?.account;

    if (!Number.isFinite(amount) || amount <= 0) {
      console.error(" 訂單金額錯誤：", amount);
      return next(appError(400, `訂單金額錯誤: ${amount}`));
    }

    if (!email || typeof email !== "string") {
      console.error(" Email 錯誤：", email);
      return next(appError(400, "找不到有效的 email"));
    }

    const rawName = productName || order.plan?.plan_name || "贊助方案";
    const safeProductName = rawName
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9 ]/g, "") // 中文全區碼 + 英數
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);

    req.body.productName = safeProductName;
    req.body.payment_type = normalizedType;

    // 處理 LINE Pay
    if (normalizedType === "linepay") {
      try {
        const result = await handleLinePayRequest({
          orderId,
          amount,
          email,
          productName: safeProductName,
          sponsorship: order,
          userId
        });
        return res.status(200).json({
          status: true,
          message: "LINE Pay 建立成功",
          data: result
        });
      } catch (lineErr) {
        console.error(" LINE Pay 建立失敗:", lineErr);
        return next(appError(500, "LINE Pay 建立失敗"));
      }
    }

    //  綠界（Credit 或 WebATM）
    try {
      return await createEcpayPayment(req, res);
    } catch (err) {
      console.error(" 綠界建立失敗:", err);
      return next(appError(500, "綠界建立失敗"));
    }
  } catch (err) {
    console.error(" createPaymentRequest 發生錯誤：", err);
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

    const sponsorshipRepo = dataSource.getRepository("Sponsorships");

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

    // 補上 ATM fallback 判斷
    let paymentMethod = order.payment_method;
    if (
      !paymentMethod &&
      order.status === "pending" &&
      order.atm_payment_no &&
      order.atm_bank_code
    ) {
      paymentMethod = "ATM";
    }

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
        bank_code: order.atm_bank_code || "",
        v_account: order.atm_payment_no || "",
        expire_date: order.atm_expire_date || "",

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
