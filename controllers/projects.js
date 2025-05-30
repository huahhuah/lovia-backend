const express = require("express");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Projects");
const appError = require("../utils/appError");
const { getProjectType } = require("../utils/projectType");
const jwt = require("jsonwebtoken");
const { validateInvoice } = require("../utils/validateInvoice");
const { v4: uuidv4 } = require("uuid");

//  步驟一：建立專案
async function createProject(req, res, next) {
  try {
    const projectRepo = dataSource.getRepository("Projects");
    const userRepo = dataSource.getRepository("Users");
    const categoryRepo = dataSource.getRepository("Categories");

    const {
      title,
      summary,
      category_id,
      total_amount,
      start_time,
      end_time,
      cover,
      full_content,
      project_team,
      faq
    } = req.body;

    const missingFields = checkMissingProjectFields(req.body);
    if (missingFields.length > 0) {
      return res.status(400).json({
        status: false,
        message: `缺少必要欄位: ${missingFields.join(", ")}`
      });
    }

    // 驗證 end_time 是否早於今天
    if (end_time !== "9999-12-31" && new Date(end_time) < new Date()) {
      return res.status(400).json({
        status: false,
        message: "結束時間不能早於今天"
      });
    }
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ status: false, message: "未提供有效的 token" });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ status: false, message: "無效的 token" });
    }

    const user = await userRepo.findOneBy({ id: decoded.id });
    if (!user) return next(appError(400, "找不到對應的使用者", next));

    const existingCategory = await categoryRepo.findOneBy({ id: category_id });
    if (!existingCategory) return next(appError(400, "無效的 category", next));
    // 自動判斷 project_type
    const project_type = getProjectType(start_time, end_time);

    const newProject = projectRepo.create({
      title,
      summary,
      category: existingCategory,
      total_amount,
      start_time,
      end_time,
      cover,
      full_content,
      project_team,
      faq,
      user,
      project_type,
      is_finished: false
    });

    const savedProject = await projectRepo.save(newProject);

    res.status(200).json({
      status: true,
      message: "專案建立成功",
      data: { project_id: savedProject.id }
    });
  } catch (err) {
    logger.error("新增專案失敗", err);
    next(appError(400, err.message || "欄位填寫不完整或有誤", next));
  }
}

function checkMissingProjectFields(body) {
  const requiredFields = [
    "title",
    "summary",
    "category_id",
    "total_amount",
    "start_time",
    "end_time",
    "cover",
    "full_content",
    "project_team",
    "faq"
  ];
  return requiredFields.filter(field => !body[field]);
}

//  步驟二：建立方案
async function createProjectPlan(req, res, next) {
  try {
    const planRepo = dataSource.getRepository("ProjectPlans");
    const projectRepo = dataSource.getRepository("Projects");

    const projectId = parseInt(req.params.id, 10);
    const { plan_name, amount, quantity, feedback, feedback_img, delivery_date } = req.body.plans;

    const project = await projectRepo.findOneBy({ id: projectId });
    if (!project) {
      return res.status(404).json({ status: false, message: "找不到專案" });
    }

    const newPlan = planRepo.create({
      plan_name,
      amount,
      quantity,
      feedback,
      feedback_img,
      delivery_date,
      project
    });

    await planRepo.save(newPlan);

    res.status(201).json({
      status: true,
      message: "回饋方案建立成功",
      data: newPlan
    });
  } catch (err) {
    console.error("建立回饋方案失敗", err);
    next(appError(500, err.message || "回饋方案建立錯誤", next));
  }
}

// 查詢專案與所有方案
async function getProject(req, res, next) {
  const projectId = parseInt(req.params.project_id, 10);

  try {
    if (isNaN(projectId)) {
      return res.status(400).json({
        status: false,
        message: "無效的 project_id"
      });
    }
    const projectRepository = dataSource.getRepository("Projects");
    const project = await projectRepository.findOne({
      where: { id: projectId },
      relations: ["projectPlans", "category"]
    });

    if (!project) {
      return next(appError(404, "無此專案"));
    }

    const sortedPlans = project.projectPlans.sort((a, b) => a.plan_id - b.plan_id);
    const plans = sortedPlans.map(plan => ({
      plan_name: plan.plan_name,
      amount: plan.amount,
      quantity: plan.quantity,
      feedback: plan.feedback,
      feedback_img: plan.feedback_img,
      delivery_date: plan.delivery_date
    }));
    
    let faq = [];
    try {
      if (project.faq) {
        faq = JSON.parse(project.faq); // 解析 faq 字串為陣列
        if (!Array.isArray(faq)) {
          throw new Error("FAQ 格式不正確，必須為陣列");
        }
      }
    } catch (error) {
      logger.error("解析 FAQ 失敗", error);
      faq = []; // 若解析失敗，設置為空陣列
    }
    
    const responseData = {
      title: project.title,
      summary: project.summary,
      category: project.category,
      total_amount: project.total_amount,
      start_time: project.start_time,
      end_time: project.end_time,
      cover: project.cover,
      full_content: project.full_content,
      project_team: project.project_team,
      faq: faq,
      plans
    };

    res.status(200).json({
      status: true,
      data: responseData
    });
  } catch (error) {
    logger.error("獲取專案資料失敗", error);
    next(error);
  }
}

//  更新專案或方案
async function updateProject(req, res, next) {
  try {
    const projectId = parseInt(req.params.project_id, 10);
    const user = req.user;
    const projectRepo = dataSource.getRepository("Projects");
    const planRepo = dataSource.getRepository("ProjectPlans");

    const project = await projectRepo.findOne({
      where: { id: projectId, user_id: user.id },
      relations: ["user", "category"]
    });
    if (!project) {
      return next(appError(400, "找不到提案"));
    }
    if (project.user.id !== user.id) {
      return next(appError(403, "你沒有修改此提案的權限"));
    }

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
      plans
    } = req.body;

    // 更新有變更的欄位
    if (title !== undefined) project.title = title;
    if (summary !== undefined) project.summary = summary;
    if (category !== undefined) project.category = category.name;  //  這裡
    if (total_amount !== undefined) project.total_amount = Number(total_amount);
    if (start_time !== undefined) project.start_time = start_time;
    if (end_time !== undefined) project.end_time = end_time;
    if (cover !== undefined) project.cover = cover;
    if (full_content !== undefined) project.full_content = full_content;
    if (project_team !== undefined) project.project_team = project_team;
    if (faq !== undefined) {
      project.faq = JSON.stringify(faq);
    }  
    // 重新判斷 project_type（用更新後的 start_time, end_time）
    project.project_type = getProjectType(project.start_time, project.end_time);
    
    let newPlans = []
    if (Array.isArray(req.body.plans)) {
      // 刪除原來plan陣列
      await planRepo.delete({ project: { id: projectId } });
      // 建立新的plan陣列
      newPlans = req.body.plans.map(plan => {
        return planRepo.create({
          plan_name: plan.plan_name,
          amount: Number(plan.amount),
          quantity: plan.quantity ? Number(plan.quantity) : 0,
          feedback: plan.feedback,
          feedback_img: plan.feedback_img,
          delivery_date: plan.delivery_date,
          project_id: { id: projectId }
        });
      });
      await planRepo.save(newPlans);
    }
    const resData = {
      title: project.title,
      summary: project.summary,
      category: project.category,
      total_amount: project.total_amount,
      start_time: project.start_time,
      end_time: project.end_time,
      cover: project.cover,
      full_content: project.full_content,
      project_team: project.project_team,
      faq: project.faq || [],
      newPlans
    };
    const updateProject = await projectRepo.save(project);
    res.status(200).json({
      status: true,
      data: resData
    });
  } catch (error) {
    logger.error("更新失敗", error);
    next(error);
  }
}

// 查詢所有專案（探索用：支援 filter、分類、分頁、排序、格式化）
async function getAllProjects(req, res, next) {
  try {
    const projectRepo = dataSource.getRepository("Projects");

    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 10;
    const filter = req.query.filter || "all";
    const categoryId = req.query.category_id ? parseInt(req.query.category_id) : null;
    const sort = req.query.sort || "newest";
    const keyword = req.query.search || "";

    const today = new Date();
    const next70Days = new Date();
    next70Days.setDate(today.getDate() + 70);

    const start = Date.now();

    const qb = projectRepo
      .createQueryBuilder("project")
      .leftJoin("project.category", "category")
      .addSelect(["category.id", "category.name", "category.image"])
      .skip((page - 1) * perPage)
      .take(perPage)
      .select([
        "project.id",
        "project.title",
        "project.summary",
        "project.start_time",
        "project.end_time",
        "project.amount",
        "project.total_amount",
        "project.cover",
        "project.created_at",
        "project.project_team",
        "project.project_type",
        "project.is_finished",
        "category.id",
        "category.name",
        "category.image"
      ]);

    // 篩選條件
    if (categoryId) {
      qb.andWhere("project.category_id = :categoryId", { categoryId });
    }

    if (keyword) {
      qb.andWhere("project.title ILIKE :kw OR project.summary ILIKE :kw", {
        kw: `%${keyword}%`
      });
    }

    // 篩選條件分類
    const filtersRequiringActive = ["recent", "funding", "long", "popular", "all"];
    if (filtersRequiringActive.includes(filter)) {
      qb.andWhere("project.is_finished = false");
    }

    switch (filter) {
      case "recent":
        qb.andWhere("project.end_time BETWEEN :today AND :next70Days", {
          today,
          next70Days
        });
        break;
      case "funding":
        qb.andWhere("project.project_type NOT IN ('長期贊助', '歷年專案')");
        break;
      case "long":
        qb.andWhere("project.project_type = '長期贊助'");
        break;
      case "archived":
        qb.andWhere("project.project_type = '歷年專案'");
        break;
      // other cases already handled
    }

    // 排序
    if (filter === "popular") {
      qb.orderBy("project.amount", "DESC").addOrderBy("project.created_at", "DESC");
    } else if (filter === "recent") {
      qb.orderBy("project.end_time", "ASC");
    } else {
      qb.orderBy("project.created_at", sort === "oldest" ? "ASC" : "DESC");
    }

    const [projects, total] = await qb.getManyAndCount();

    if (process.env.NODE_ENV !== "production") {
      console.log("查詢耗時：", Date.now() - start, "ms");
    }

    const formatted = projects.map(p => {
      const percentage = p.total_amount === 0 ? 0 : (p.amount / p.total_amount) * 100;
      const daysLeft = Math.max(
        0,
        Math.ceil((new Date(p.end_time) - new Date()) / (1000 * 60 * 60 * 24))
      );

      return {
        id: p.id,
        title: p.title,
        summary: p.summary,
        start_time: p.start_time,
        end_time: p.end_time,
        amount: p.amount,
        total_amount: p.total_amount,
        percentage: parseFloat(percentage.toFixed(2)),
        days_left: daysLeft,
        cover: p.cover,
        created_at: p.created_at,
        proposer: p.project_team || "未知提案者",
        category_img: p.category?.image || "/default.png",
        category_id: p.category?.id || null,
        category_name: p.category?.name || "未分類",
        project_type: p.project_type,
        is_success: p.amount >= p.total_amount,
        is_ending_soon: daysLeft <= 7
      };
    });

    res.status(200).json({
      status: true,
      message: "專案列表取得成功",
      data: formatted,
      pagination: {
        current_page: page,
        per_page: perPage,
        total_pages: Math.ceil(total / perPage)
      }
    });
  } catch (error) {
    logger.warn("取得專案失敗", error);
    next(error);
  }
}

//查詢所有分類
async function getAllCategories(req, res, next) {
  try {
    const categoryRepo = dataSource.getRepository("Categories");
    const categories = await categoryRepo.find({
      select: ["id", "name", "image"], // 若只需這些欄位
      order: { name: "ASC" }
    });

    res.status(200).json({
      status: true,
      message: "分類列表取得成功",
      data: categories
    });
  } catch (error) {
    logger.error("取得分類失敗：", error);
    next(error);
  }
}

// 查詢專案概覽
function getCategoryImg(name) {
  const map = {
    動物: "animal",
    醫療: "medical",
    人文: "humanity",
    環境: "environment",
    救援: "rescue"
  };

  const fileKey = Object.keys(map).find(key => name?.includes(key));
  return fileKey ? `/images/categories/${map[fileKey]}.png` : "";
}

async function getProjectOverview(req, res, next) {
  const projectId = parseInt(req.params.projectId);

  if (isNaN(projectId) || projectId < 1) {
    return next(appError(400, "無效的查詢參數"));
  }

  try {
    const projectRepo = dataSource.getRepository("Projects");

    // 查詢 project 本身資料（需包含 category 關聯）
    const project = await projectRepo.findOne({
      where: { id: projectId },
      relations: ["category"]
    });

    if (!project) {
      return next(appError(404, "找不到該專案"));
    }

    const categoryName = project.category?.name || "";
    const categoryImg = getCategoryImg(categoryName);

    // 計算進度與剩餘天數
    const current_amount = project.current_amount || 0;
    const progress_percent = Math.min(
      100,
      Math.floor((current_amount / project.total_amount) * 100)
    );

    const today = new Date();
    const end = new Date(project.end_time);
    const remaining_days = Math.max(0, Math.ceil((end - today) / (1000 * 60 * 60 * 24)));

    res.status(200).json({
      status: true,
      message: "提案查詢成功",
      data: {
        title: project.title,
        summary: project.summary,
        category: project.category || null,
        category_img: categoryImg,
        total_amount: project.total_amount,
        current_amount,
        progress_percent,
        start_time: project.start_time,
        end_time: project.end_time,
        remaining_days,

        cover: project.cover,
        full_content: project.full_content,
        project_team: project.project_team
      }
    });
  } catch (err) {
    logger.error("查詢提案概覽失敗", err);
    return next(appError(500, "查詢提案資料時發生錯誤"));
  }
}

//查詢某個專案（projectId）底下的所有回饋方案（plans）
async function getProjectPlans(req, res, next) {
  const projectId = parseInt(req.params.projectId);

  if (isNaN(projectId)) {
    return next(appError(400, "無效的專案 ID"));
  }
  try {
    const projectRepo = dataSource.getRepository("Projects");
    const project = await projectRepo.findOneBy({ id: projectId });
    if (!project) {
      return next(appError(404, "找不到該專案"));
    }

    const planRepo = dataSource.getRepository("ProjectPlans");

    const plans = await planRepo.find({
      where: { project_id: projectId }
    });

    if (plans.length === 0) {
      return next(appError(404, "找不到該提案的回饋方案"));
    }

    res.status(200).json({
      status: true,
      message: `專案 ${projectId} 的回饋方案取得成功`,
      data: plans
    });
  } catch (error) {
    logger.warn("取得回饋方案失敗", error);
    next(error);
  }
}

// 取得進度
async function getProgress(req, res, next) {
  try {
    const { project_id } = req.params;
    if (!project_id) {
      return next(appError(400, "請求錯誤"));
    }
    const progressRepository = dataSource.getRepository("ProjectProgresses");
    const progresses = await progressRepository.find({
      where: { project_id },
      order: { date: "DESC" },
      relations: {
        fundUsages: {
          status: true
        }
      }
    });

    const result = progresses.map(progress => {
      const allUsage = (progress.fundUsages || []).map(usage => ({
        recipient: usage.recipient,
        usage: usage.usage,
        amount: usage.amount,
        status: usage.status?.code || null
      }));
      return {
        id: progress.id,
        title: progress.title,
        date: progress.date,
        content: progress.content,
        fund_usages: allUsage
      };
    });
    res.status(200).json({
      status: true,
      message: "成功取得進度分享",
      data: result
    });
  } catch (error) {
    logger.error("取得進度資料失敗", error);
    next(error);
  }
}

//新增留言
async function createProjectComment(req, res, next) {
  try {
    const { project_id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    //驗證留言內容
    if (!content || content.trim() === "") {
      return next(appError(400, "留言內容不能為空"));
    }

    const commentRepo = dataSource.getRepository("ProjectComments");

    const newComment = commentRepo.create({
      content,
      user: {
        id: userId
      },
      project: {
        id: parseInt(project_id)
      }
    });

    await commentRepo.save(newComment);
    res.status(200).json({
      status: true,
      message: "留言成功",
      data: newComment
    });
  } catch (error) {
    logger.error("建立留言失敗", error);
    next(error);
  }
}

//使用者針對某個專案的某個回饋方案進行贊助
async function sponsorProjectPlan(req, res, next) {
  try {
    const { project_id, plan_id } = req.params;
    const { sponsorship = {} } = req.body;
    const { display_name, note, amount } = sponsorship;
    const userId = req.user.id;

    const pid = parseInt(project_id, 10);
    const planId = parseInt(plan_id, 10);

    const projectRepo = dataSource.getRepository("Projects");
    const planRepo = dataSource.getRepository("ProjectPlans");
    const sponsorRepo = dataSource.getRepository("Sponsorships");

    const project = await projectRepo.findOneBy({ id: pid });
    if (!project) return next(appError(404, "找不到該專案"));
    if (project.project_type === "歷年專案") return next(appError(403, "歷年專案無法再進行贊助"));

    const plan = await planRepo.findOneBy({ plan_id: planId }); // ✅ plan_id 是 ProjectPlans 的主鍵

    if (!plan) return next(appError(404, "找不到回饋方案"));

    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt < 0) return next(appError(400, "贊助金額必須為正整數"));

    const newSponsorship = sponsorRepo.create({
      user: { id: userId },
      project: { id: pid },
      plan: { plan_id: planId },
      quantity: 1,
      amount: amt,
      display_name: display_name || "",
      note: note || ""
    });

    await sponsorRepo.save(newSponsorship);

    res.status(200).json({
      status: true,
      message: "贊助成功",
      data: newSponsorship
    });
  } catch (error) {
    console.error("贊助失敗：", error);
    logger.error("贊助過程中發生錯誤", error);
    next(appError(500, "伺服器錯誤", error));
  }
}

// 建立完整訂單資訊：含贊助、發票、寄送資料
async function createProjectSponsorship(req, res, next) {
  const { project_id, plan_id } = req.params;
  const { sponsorship = {}, invoice = {}, shipping = {} } = req.body;
  const userId = req.user?.id;

  try {
    if (!userId) return next(appError(401, "請先登入再進行贊助"));

    const projectRepo = dataSource.getRepository("Projects");
    const planRepo = dataSource.getRepository("ProjectPlans");
    const sponsorshipRepo = dataSource.getRepository("Sponsorships");
    const shippingRepo = dataSource.getRepository("Shippings");
    const invoiceRepo = dataSource.getRepository("Invoices");
    const invoiceTypeRepo = dataSource.getRepository("InvoiceTypes");

    const project = await projectRepo.findOneBy({
      id: parseInt(project_id)
    });
    if (!project) {
      return next(appError(404, "找不到該專案"));
    }

    const planIdInt = parseInt(plan_id);
    if (isNaN(planIdInt)) {
      return next(appError(400, "回饋方案參數無效"));
    }

    const plan = await planRepo.findOneBy({ plan_id: planIdInt });
    console.log(" 查到的回饋方案：", plan);
    if (!plan) {
      return next(appError(404, "找不到回饋方案"));
    }

    const amount = Number(sponsorship.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      return next(appError(400, "贊助金額必須為正整數"));
    }

    const newSponsorship = sponsorshipRepo.create({
      user: { id: userId },
      project,
      plan,
      quantity: 1,
      amount,
      order_uuid: uuidv4(),
      display_name: sponsorship.display_name?.trim() || "匿名",
      note: sponsorship.note?.trim() || "",
      status: "pending"
    });
    await sponsorshipRepo.save(newSponsorship);

    const hasShippingInfo =
      !!shipping.name?.trim() ||
      !!shipping.phone?.trim() ||
      !!shipping.address?.trim() ||
      !!shipping.note?.trim();

    if (hasShippingInfo) {
      const newShipping = shippingRepo.create({
        sponsorship: { id: newSponsorship.id },
        name: shipping.name?.trim() || "未提供姓名",
        phone: shipping.phone?.trim() || "0912345678",
        address: shipping.address?.trim() || "未提供地址",
        note: shipping.note?.trim() || ""
      });
      await shippingRepo.save(newShipping);
    }

    const invoiceTypeCode = invoice.type?.trim?.();
    if (invoiceTypeCode) {
      const invoiceType = await invoiceTypeRepo.findOneBy({ code: invoiceTypeCode });
      if (!invoiceType) return next(appError(400, "發票類型無效"));

      try {
        validateInvoice(invoice, invoiceTypeCode);
      } catch (err) {
        return next(appError(400, err.message || "發票格式錯誤"));
      }

      const newInvoice = invoiceRepo.create({
        sponsorship: { id: newSponsorship.id },
        type: invoiceType,
        carrier_code: invoice.carrier_code?.trim() || null,
        tax_id: invoice.tax_id?.trim() || null,
        title: invoice.title?.trim() || null
      });
      await invoiceRepo.save(newInvoice);
    }

    res.status(200).json({
      status: true,
      message: "訂單建立成功，請完成付款",
      data: {
        orderId: newSponsorship.order_uuid,
        sponsorshipId: newSponsorship.id,
        amount: newSponsorship.amount
      }
    });
  } catch (error) {
    console.error("建立贊助失敗:", error.message);
    console.error(" error.stack:\n", error.stack);
    console.error(" 完整錯誤物件:", error);
    if (error?.detail) {
      console.error(" PG Detail:", error.detail);
    }
    if (error?.query) {
      console.error(" SQL:", error.query);
    }
    if (error?.parameters) {
      console.error(" Params:", error.parameters);
    }

    return next(appError(500, error.message || "伺服器錯誤"));
  }
}

// 取得單一專案faq
async function getProjectFaq(req, res, next) {
  try {
    const { project_id } = req.params;
    if(!project_id) {
      return next(appError(400, '請求錯誤'))
    }
    const projectRepo = dataSource.getRepository("Projects");
    const project = await projectRepo.findOne({
      where: {id: project_id},
    })
    
    let faq = [];
    try{
      if(project.faq) {
        faq = JSON.parse(project.faq);
        if (!Array.isArray(faq)){
          throw new Error("FAQ 格式不正確，必須為陣列");
        }
      }
    } catch (error) {
      logger.error("解析 FAQ 失敗", error);
      faq = [];
    }

    res.status(200).json({
      status: true,
      message: "成功取得專案FAQ",
      data: faq
    })
  } catch (error){
    logger.error("取得FAQ失敗", error);
    next(error);
  }
}

// 取得單一專案留言
async function getProjectComment(req, res, next){
  try {
    const { project_id } = req.params;
    if (!project_id){
      return next(appError(400,'請求錯誤'));
    }
    const commentRepo = dataSource.getRepository("ProjectComments");
    const comments = await commentRepo.find({
      where: {project: {id: project_id}},
      order: {created_at: 'DESC'},
      relations: ['project' , 'user'] 
    })
    // 擷取需要的回傳
    const usefulData = comments.map(comment =>({
      comment_id: comment.comment_id,
      content: comment.content,
      created_at: comment.created_at.toISOString(),
      project:{ id: comment.project.id},
      user:{
        id: comment.user.id,
        name: comment.user.username
      }
    }))

    res.status(200).json({
      status: true,
      message: "成功取得專案留言",
      data: usefulData
    })
  } catch (error){
    next(error);
  }
}

module.exports = {
  createProject,
  createProjectPlan,
  getProject,
  updateProject,
  getAllProjects,
  getAllCategories,
  getProjectOverview,
  getProjectPlans,
  getProgress,
  createProjectComment,
  sponsorProjectPlan,
  createProjectSponsorship,
  getProjectFaq,
  getProjectComment
};
