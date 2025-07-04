const express = require("express");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Projects");
const appError = require("../utils/appError");
const { getProjectType } = require("../utils/projectType");
const jwt = require("jsonwebtoken");
const { validateInvoice } = require("../utils/validateInvoice");
const { v4: uuidv4 } = require("uuid");
const { In } = require("typeorm");
const Project = require("../entities/Projects");
const ProjectComments = require("../entities/Project_comments");
const { Not, IsNull } = require("typeorm");

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
      faq,
      status
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
      is_finished: false,
      status: 1
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
    const projectId = parseInt(req.params.id, 10);
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

    // 更新欄位
    if (title !== undefined) project.title = title;
    if (summary !== undefined) project.summary = summary;
    if (category !== undefined) {
      if (typeof category === "object" && category.id !== undefined) {
        project.category_id = category.id;
      } else if (typeof category === "number") {
        project.category_id = category;
      } else if (typeof category === "string") {
        project.category_id = parseInt(category, 10);
      }
    }
    if (total_amount !== undefined) project.total_amount = Number(total_amount);
    if (start_time !== undefined) project.start_time = start_time;
    if (end_time !== undefined) project.end_time = end_time;
    if (cover !== undefined) project.cover = cover;
    if (full_content !== undefined) project.full_content = full_content;
    if (project_team !== undefined) project.project_team = project_team;
    if (faq !== undefined) {
      project.faq = JSON.stringify(faq);
    } else if (project.faq && typeof project.faq !== "string") {
      project.faq = JSON.stringify(project.faq); // 確保是字串格式儲存
    }

    // 重新判斷 project_type
    project.project_type = getProjectType(project.start_time, project.end_time);

    // 更新 plans
    let newPlans = [];
    if (Array.isArray(plans)) {
      // 刪除原本的 plans（用 project_id 外鍵）
      await planRepo.delete({ project_id: projectId });

      // 建立新的 plans 陣列
      newPlans = plans.map(plan => {
        return planRepo.create({
          plan_name: plan.plan_name,
          amount: Number(plan.amount),
          quantity: plan.quantity ? Number(plan.quantity) : 0,
          feedback: plan.feedback,
          feedback_img: plan.feedback_img,
          delivery_date: plan.delivery_date,
          project_id: projectId
        });
      });

      await planRepo.save(newPlans);
    }

    // 儲存更新後的專案
    const updatedProject = await projectRepo.save(project);

    // 回傳資料，faq 要回傳物件/陣列
    const resData = {
      title: updatedProject.title,
      summary: updatedProject.summary,
      category_id: updatedProject.category_id,
      total_amount: updatedProject.total_amount,
      start_time: updatedProject.start_time,
      end_time: updatedProject.end_time,
      cover: updatedProject.cover,
      full_content: updatedProject.full_content,
      project_team: updatedProject.project_team,
      faq: updatedProject.faq ? JSON.parse(updatedProject.faq) : [],
      plans: newPlans
    };

    res.status(200).json({
      status: true,
      data: resData
    });
  } catch (error) {
    logger.error("更新失敗", error);
    next(error);
  }
}

async function updateProjectPlan(req, res) {
  const projectId = parseInt(req.params.project_id, 10);
  const planId = parseInt(req.params.planId, 10);

  const { plan_name, amount, quantity, feedback, feedback_img, delivery_date } = req.body;

  try {
    const planRepository = dataSource.getRepository("ProjectPlans");

    // 找出該方案，確保它是屬於這個專案的
    const plan = await planRepository.findOne({
      where: {
        plan_id: planId,
        project_id: projectId
      }
    });

    if (!plan) {
      return res.status(404).json({ message: "Plan not found." });
    }

    // 更新欄位
    plan.plan_name = plan_name;
    plan.amount = amount;
    plan.quantity = quantity;
    plan.feedback = feedback;
    plan.feedback_img = feedback_img;
    plan.delivery_date = delivery_date;

    await planRepository.save(plan);

    return res.json(plan);
  } catch (error) {
    logger.error(error);
    return res.status(500).json({ message: "Server error." });
  }
}

async function deleteProjectPlan(req, res) {
  const projectId = parseInt(req.params.project_id, 10);
  const planId = parseInt(req.params.planId, 10);

  try {
    const planRepository = dataSource.getRepository("ProjectPlans");

    // 確認該方案是否存在，且屬於該 project
    const plan = await planRepository.findOne({
      where: {
        plan_id: planId,
        project_id: projectId
      }
    });

    if (!plan) {
      return res.status(404).json({ message: "該方案不存在或不屬於該專案" });
    }

    await planRepository.remove(plan);

    return res.json({ message: "方案已刪除成功" });
  } catch (error) {
    logger.error("刪除方案失敗：", error);
    return res.status(500).json({ message: "刪除方案時發生錯誤" });
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
      ])
      .andWhere("project.status = :approvedStatus", { approvedStatus: 2 });

    // 篩選分類
    if (categoryId) {
      qb.andWhere("project.category_id = :categoryId", { categoryId });
    }

    // 關鍵字搜尋
    if (keyword) {
      qb.andWhere("project.title ILIKE :kw OR project.summary ILIKE :kw", {
        kw: `%${keyword}%`
      });
    }

    // 各 filter 條件
    switch (filter) {
      case "recent":
        qb.andWhere("project.end_time > :today", { today });
        break;
      case "funding":
        qb.andWhere("project.is_finished = false");
        qb.andWhere("project.project_type NOT IN ('長期贊助', '歷年專案')");
        break;
      case "long":
        qb.andWhere("project.is_finished = false");
        qb.andWhere("project.project_type = '長期贊助'");
        break;
      case "archived":
        qb.andWhere("project.project_type = '歷年專案'");
        break;
      case "popular":
        qb.andWhere("project.is_finished = false");
        break;
      // case "all": 不加 is_finished 限制，抓全部
    }

    // 排序邏輯
    if (filter === "popular") {
      qb.orderBy("project.amount", "DESC").addOrderBy("project.created_at", "DESC");
    } else if (filter === "recent") {
      qb.orderBy("project.end_time", "ASC"); // 即將到期的在前
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
      total,
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

// 查詢專案概覽
async function getProjectOverview(req, res, next) {
  const projectId = parseInt(req.params.projectId);

  if (isNaN(projectId) || projectId < 1) {
    return next(appError(400, "無效的查詢參數"));
  }
  function getProjectType(project) {
    const now = new Date();
    const end = new Date(project.end_time);

    if (end < now) return "歷年專案";
    if (project?.projectStatus?.status === "長期贊助") return "長期贊助";
    return "募資中";
  }

  try {
    const projectRepo = dataSource.getRepository("Projects");

    // 查詢 project 本身資料（需包含 category 關聯）
    const project = await projectRepo.findOne({
      where: { id: projectId },
      relations: ["category", "projectStatus"]
    });
    console.log("查到的 project 資料：", project);

    if (!project) {
      return next(appError(404, "找不到該專案"));
    }

    //  動態計算 project_type
    project.project_type = getProjectType(project);

    //類別圖示
    const categoryName = project.category?.name || "";
    const categoryImg = getCategoryImg(categoryName);

    // 計算進度
    const total = project.total_amount || 1; // 避免除以 0
    const current_amount = project.amount || 0;
    const progress_percent = Math.min(100, Math.floor((current_amount / total) * 100));

    //剩餘天數
    const today = new Date();
    const end = new Date(project.end_time);
    const remaining_days = Math.max(0, Math.ceil((end - today) / (1000 * 60 * 60 * 24)));

    // 加入贊助人數統計
    const sponsorRepo = dataSource.getRepository("Sponsorships");
    const supporters = await sponsorRepo.count({
      where: {
        project: { id: projectId },
        status: "paid"
      }
    });

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
        supporters,
        cover: project.cover,
        full_content: project.full_content,
        project_team: project.project_team,
        project_type: project.project_type
      }
    });
  } catch (err) {
    console.error(" 捕捉到錯誤:", err);
    logger.error("查詢提案概覽失敗", {
      message: err.message,
      stack: err.stack,
      detail: err?.detail,
      query: err?.query,
      parameters: err?.parameters
    });
    return next(appError(500, "查詢提案資料時發生錯誤"));
  }
}

//查詢某個專案（projectId）底下的所有回饋方案（plans），包含贊助人數
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

    const plans = await planRepo
      .createQueryBuilder("plan")
      .where("plan.project_id = :projectId", { projectId })
      .loadRelationCountAndMap(
        "plan.sponsor_count", //  quantity 會變成每個 plan 的欄位
        "plan.sponsorships",
        "s",
        qb => qb.where("s.status = :status", { status: "paid" }) // 只計算已付款的
      )
      .getMany();

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

// 使用者針對某個專案的某個回饋方案進行贊助
async function sponsorProjectPlan(req, res, next) {
  try {
    const { project_id, plan_id } = req.params;
    const { sponsorship = {} } = req.body;
    const { display_name, note, amount } = sponsorship;

    // 檢查登入狀態
    if (!req.user || !req.user.id) {
      console.warn(" 無法取得登入使用者資料 (req.user)");
      return next(appError(401, "請先登入"));
    }

    const userId = req.user.id;

    // 整數轉換與驗證
    const pid = parseInt(project_id, 10);
    const planId = parseInt(plan_id, 10);
    const amt = Number(amount);

    if (!Number.isInteger(pid) || !Number.isInteger(planId)) {
      return next(appError(400, "無效的 project_id 或 plan_id"));
    }

    if (!Number.isInteger(amt) || amt <= 0) {
      return next(appError(400, "贊助金額必須為正整數"));
    }

    // 取得資料表
    const projectRepo = dataSource.getRepository("Projects");
    const planRepo = dataSource.getRepository("ProjectPlans");
    const sponsorRepo = dataSource.getRepository("Sponsorships");

    // 尋找專案與方案
    const project = await projectRepo.findOneBy({ id: pid });
    if (!project) return next(appError(404, "找不到該專案"));
    if (project.project_type === "歷年專案") {
      return next(appError(403, "歷年專案無法再進行贊助"));
    }

    const plan = await planRepo.findOneBy({ plan_id: planId });
    if (!plan) return next(appError(404, "找不到回饋方案"));

    //  Log 即將儲存的資料
    console.log(" 建立贊助紀錄：", {
      user_id: userId,
      project_id: pid,
      plan_id: planId,
      amount: amt,
      display_name,
      note
    });

    // 建立實體
    const newSponsorship = sponsorRepo.create({
      user: { id: userId },
      project: { id: pid },
      plan, // TypeORM 識別的是物件
      quantity: 1,
      amount: amt,
      display_name: display_name?.trim() || "匿名",
      note: note?.trim() || "",
      status: "pending"
    });

    const saved = await sponsorRepo.save(newSponsorship);
    console.log(" 贊助成功，ID:", saved.id);

    res.status(200).json({
      status: true,
      message: "贊助成功",
      data: saved
    });
  } catch (error) {
    console.error(" 贊助失敗");
    console.error(" error.message:", error?.message || error);
    console.error(" error.stack:", error?.stack || "無堆疊資訊");
    if (error?.detail) console.error(" PostgreSQL Detail:", error.detail);
    if (error?.query) console.error(" SQL Query:", error.query);
    if (error?.parameters) console.error(" Params:", error.parameters);

    return res.status(500).json({
      status: false,
      message: "伺服器錯誤",
      debug: {
        message: error?.message || null,
        detail: error?.detail || null,
        query: error?.query || null,
        parameters: error?.parameters || null
      }
    });
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

    const project = await projectRepo.findOneBy({ id: parseInt(project_id) });
    if (!project) return next(appError(404, "找不到該專案"));

    const planIdInt = parseInt(plan_id);
    if (isNaN(planIdInt)) return next(appError(400, "回饋方案參數無效"));

    const plan = await planRepo.findOneBy({ plan_id: planIdInt });
    if (!plan) return next(appError(404, "找不到回饋方案"));

    const amount = Number(sponsorship.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      return next(appError(400, "贊助金額必須為正整數"));
    }

    const existing = await sponsorshipRepo.findOne({
      where: {
        user: { id: userId },
        project: { id: parseInt(project_id) },
        plan: { plan_id: planIdInt },
        amount,
        status: "pending"
      },
      relations: ["invoice", "shipping"]
    });

    const invoiceTypeCode = typeof invoice.type === "string" ? invoice.type.trim() : "";

    // 如果已有訂單但沒有 shipping 或 invoice，補上
    if (existing) {
      if (!existing.shipping) {
        const newShipping = shippingRepo.create({
          name: shipping?.name?.trim() || "未提供姓名",
          phone: shipping?.phone?.trim() || "0912345678",
          address: shipping?.address?.trim() || "未提供地址",
          note: shipping?.note?.trim() || ""
        });
        existing.shipping = await shippingRepo.save(newShipping);
      }

      if (!existing.invoice && invoiceTypeCode) {
        const invoiceType = await invoiceTypeRepo.findOneBy({ code: invoiceTypeCode });
        if (!invoiceType) return next(appError(400, "發票類型無效"));

        try {
          validateInvoice(invoice, invoiceTypeCode);
        } catch (err) {
          return next(appError(400, err.message || "發票格式錯誤"));
        }

        const newInvoice = invoiceRepo.create({
          type: invoiceType,
          carrier_code: invoice.carrier_code?.trim() || null,
          tax_id: invoice.tax_id?.trim() || null,
          title: invoice.title?.trim() || null
        });
        existing.invoice = await invoiceRepo.save(newInvoice);
      }

      await sponsorshipRepo.save(existing);

      return res.status(200).json({
        status: true,
        message: "已有相同金額的未付款訂單，請完成付款",
        data: {
          orderId: existing.order_uuid,
          sponsorshipId: existing.id,
          amount: existing.amount
        }
      });
    }

    // 建立新 sponsorship
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

    // 建立 shipping
    const newShipping = shippingRepo.create({
      name: shipping?.name?.trim() || "未提供姓名",
      phone: shipping?.phone?.trim() || "0912345678",
      address: shipping?.address?.trim() || "未提供地址",
      note: shipping?.note?.trim() || ""
    });
    newSponsorship.shipping = await shippingRepo.save(newShipping);

    // 建立 invoice（如有）
    if (invoiceTypeCode) {
      const invoiceType = await invoiceTypeRepo.findOneBy({ code: invoiceTypeCode });
      if (!invoiceType) return next(appError(400, "發票類型無效"));

      try {
        validateInvoice(invoice, invoiceTypeCode);
      } catch (err) {
        return next(appError(400, err.message || "發票格式錯誤"));
      }

      const newInvoice = invoiceRepo.create({
        type: invoiceType,
        carrier_code: invoice.carrier_code?.trim() || null,
        tax_id: invoice.tax_id?.trim() || null,
        title: invoice.title?.trim() || null
      });
      newSponsorship.invoice = await invoiceRepo.save(newInvoice);
    }

    // 最終儲存 sponsorship（含關聯）
    await sponsorshipRepo.save(newSponsorship);

    return res.status(200).json({
      status: true,
      message: "訂單建立成功，請完成付款",
      data: {
        orderId: newSponsorship.order_uuid,
        sponsorshipId: newSponsorship.id,
        amount: newSponsorship.amount
      }
    });
  } catch (error) {
    console.error("建立贊助失敗:", error);
    return next(appError(500, error.message || "伺服器錯誤"));
  }
}

// 取得單一專案faq
async function getProjectFaq(req, res, next) {
  try {
    const { project_id } = req.params;
    if (!project_id) {
      return next(appError(400, "請求錯誤"));
    }
    const projectRepo = dataSource.getRepository("Projects");
    const project = await projectRepo.findOne({
      where: { id: project_id }
    });

    let faq = [];
    try {
      if (project.faq) {
        faq = JSON.parse(project.faq);
        if (!Array.isArray(faq)) {
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
    });
  } catch (error) {
    logger.error("取得FAQ失敗", error);
    next(error);
  }
}

// 取得提案者的專案總覽
async function getMyProjects(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return next(appError(401, "未登入"));

    const projectRepo = dataSource.getRepository("Projects");
    const sponsorshipRepo = dataSource.getRepository("Sponsorships");
    const shippingRepo = dataSource.getRepository("Shippings");

    const projects = await projectRepo.find({
      where: { user: { id: userId } },
      order: { id: "DESC" },
      relations: ["projectPlans", "projectStatus"]
    });

    const result = [];

    for (const p of projects) {
      const supportTotal = await sponsorshipRepo
        .createQueryBuilder("s")
        .where("s.project_id = :projectId", { projectId: p.id })
        .select("SUM(s.amount)", "total")
        .getRawOne();

      const hasShipping = await shippingRepo.findOne({
        where: { sponsorship: { project: { id: p.id } } },
        relations: ["sponsorship"]
      });

      result.push({
        id: p.id,
        title: p.title,
        targetAmount: p.total_amount,
        supportAmount: parseInt(supportTotal?.total || 0),
        project_type: p.project_type || "未設定",
        auditStatus: p.projectStatus?.status || "無", // 這裡改成 status 欄位
        rewardItem: p.projectPlans?.[0]?.feedback || "-",
        shippingInfo: !!hasShipping
      });
    }

    res.status(200).json({
      status: true,
      message: "成功取得提案總覽",
      data: result
    });
  } catch (error) {
    console.error("getMyProjects 錯誤", error);
    next(appError(500, "伺服器錯誤"));
  }
}

// 取得單一專案留言
async function getProjectComment(req, res, next) {
  try {
    const { project_id } = req.params;
    if (!project_id) {
      return next(appError(400, "請求錯誤"));
    }

    const commentRepo = dataSource.getRepository("ProjectComments");
    const comments = await commentRepo.find({
      where: { project: { id: project_id } },
      order: { created_at: "DESC" },
      relations: ["project", "user"]
    });

    const usefulData = comments.map(comment => ({
      comment_id: comment.comment_id,
      content: comment.content,
      created_at: comment.created_at.toISOString(),
      reply_content: comment.reply_content || null,
      reply_at: comment.reply_at ? comment.reply_at.toISOString() : null,
      project: { id: comment.project.id },
      user: comment.user
        ? {
            id: comment.user.id,
            name: comment.user.username,
            avatar_url: comment.user.avatar_url
          }
        : {
            id: null,
            name: "未知用戶",
            avatar_url: null
          }
    }));

    res.status(200).json({
      status: true,
      message: "成功取得專案留言",
      data: usefulData
    });
  } catch (error) {
    next(error);
  }
}

async function deleteProject(req, res, next) {
  try {
    const userId = req.user?.id;
    const projectId = parseInt(req.params.id, 10);

    console.log("刪除專案請求:", {
      userId,
      projectId,
      rawId: req.params.id,
      userInfo: req.user
    });

    if (!userId) {
      console.log("用戶未登入");
      return next(appError(401, "未登入"));
    }

    if (isNaN(projectId)) {
      console.log("專案 ID 格式錯誤:", req.params.id);
      return next(appError(400, "專案 ID 格式錯誤"));
    }

    const projectRepo = dataSource.getRepository("Projects");
    const planRepo = dataSource.getRepository("ProjectPlans");
    const sponsorshipRepo = dataSource.getRepository("Sponsorships");
    const shippingRepo = dataSource.getRepository("Shippings");

    // 取得專案並驗證擁有者
    const project = await projectRepo.findOne({
      where: { id: projectId },
      relations: ["user"]
    });

    console.log("查詢專案結果:", {
      found: !!project,
      projectId,
      projectOwner: project?.user?.id,
      currentUser: userId,
      projectOwnerType: typeof project?.user?.id,
      currentUserType: typeof userId
    });

    if (!project) {
      console.log(`專案不存在: ID ${projectId}`);
      return next(appError(404, "找不到該專案"));
    }

    // 將兩邊轉為字串比較，避免型態不同導致比較失敗
    if (String(project.user.id) !== String(userId)) {
      console.log(`權限不足: 專案擁有者 ${project.user.id}, 當前用戶 ${userId}`);
      return next(appError(403, "無權限刪除此專案"));
    }

    console.log("開始刪除專案相關資料...");

    // 取得該專案所有贊助
    const sponsorships = await sponsorshipRepo.find({
      where: { project: { id: projectId } }
    });

    console.log(`找到 ${sponsorships.length} 筆贊助記錄`);

    const sponsorshipIds = sponsorships.map(s => s.id);

    // 刪除相關 shipping
    if (sponsorshipIds.length > 0) {
      const shippingDeleteResult = await shippingRepo.delete({
        sponsorship: In(sponsorshipIds)
      });
      console.log("刪除配送記錄:", shippingDeleteResult.affected);
    }

    // 刪除贊助紀錄
    const sponsorshipDeleteResult = await sponsorshipRepo.delete({
      project: { id: projectId }
    });
    console.log("刪除贊助記錄:", sponsorshipDeleteResult.affected);

    // 刪除專案方案
    const planDeleteResult = await planRepo.delete({
      project: { id: projectId }
    });
    console.log("刪除專案方案:", planDeleteResult.affected);

    // 刪除主專案
    const projectDeleteResult = await projectRepo.delete({ id: projectId });
    console.log("刪除主專案:", projectDeleteResult.affected);

    console.log("專案刪除完成");

    return res.status(200).json({
      status: true,
      message: "專案及相關資料刪除成功"
    });
  } catch (error) {
    console.error("刪除專案錯誤:", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      projectId: req.params.id
    });
    return next(appError(500, "伺服器錯誤"));
  }
}

async function getMyAllQuestions(req, res, next) {
  try {
    const userId = req.user.id;

    const commentRepo = dataSource.getRepository(ProjectComments);

    const myQuestions = await commentRepo.find({
      where: {
        user: { id: userId },
        project: Not(IsNull()) // ✅ 這一行是關鍵：排除已被刪除的專案留言
      },
      order: { created_at: "DESC" },
      relations: ["project"]
    });

    const result = myQuestions.map(q => ({
      comment_id: q.comment_id,
      content: q.content,
      created_at: q.created_at.toISOString(),
      project: q.project
        ? {
            id: q.project.id,
            title: q.project.title
          }
        : null,
      reply_content: q.reply_content ?? null, // 加上回覆內容
      reply_at: q.reply_at ? q.reply_at.toISOString() : null // 加上回覆時間
    }));

    res.status(200).json({
      status: true,
      message: "取得我全部提問成功",
      data: result
    });
  } catch (error) {
    console.error("取得全部提問失敗", error);
    res.status(500).json({
      status: false,
      message: "取得全部提問發生錯誤",
      error: error.message
    });
  }
}

async function getMyProjectsQuestions(req, res, next) {
  try {
    const userId = req.user.id;

    const projectRepo = dataSource.getRepository(Project);
    const commentRepo = dataSource.getRepository(ProjectComments);

    // 1. 取出該使用者的專案 id
    const myProjects = await projectRepo.find({
      where: { user: { id: userId } },
      select: ["id", "title"] // 這裡也選title，方便回傳
    });
    const myProjectIds = myProjects.map(p => p.id);

    if (myProjectIds.length === 0) {
      return res.status(200).json({
        status: true,
        message: "你目前沒有任何專案",
        data: []
      });
    }

    // 2. 取得這些專案的提問（留言）
    const questions = await commentRepo.find({
      where: { project: { id: In(myProjectIds) } },
      order: { created_at: "DESC" },
      relations: ["user", "project"]
    });

    // 3. 篩選必要欄位回傳，包括回覆
    const result = questions.map(q => ({
      comment_id: q.comment_id,
      content: q.content,
      created_at: q.created_at.toISOString(),
      project: {
        id: q.project.id,
        title: q.project.title
      },
      user: {
        id: q.user?.id,
        name: q.user?.username || q.user?.email || "匿名",
        avatar_url: q.user?.avatar_url || null
      },
      reply_content: q.reply_content || null,
      reply_at: q.reply_at ? q.reply_at.toISOString() : null
    }));

    res.status(200).json({
      status: true,
      message: "取得提案者全部提案的提問總覽成功",
      data: result
    });
  } catch (error) {
    console.error("取得提案者提問總覽失敗", error);
    res.status(500).json({
      status: false,
      message: "取得提問總覽發生錯誤",
      error: error.message
    });
  }
}

async function replyToProjectComment(req, res, next) {
  try {
    const userId = req.user.id;
    const commentId = parseInt(req.params.id, 10);
    const { content } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({ status: false, message: "回覆內容不得為空" });
    }

    const projectRepo = dataSource.getRepository(Project);
    const commentRepo = dataSource.getRepository(ProjectComments);

    const myProjects = await projectRepo.find({
      where: { user: { id: userId } },
      select: ["id"]
    });
    const myProjectIds = myProjects.map(p => p.id);

    const comment = await commentRepo.findOne({
      where: { comment_id: commentId },
      relations: ["project"]
    });

    if (!comment) {
      return res.status(404).json({ status: false, message: "找不到這筆提問" });
    }

    if (!myProjectIds.includes(comment.project.id)) {
      return res.status(403).json({ status: false, message: "無權回覆這筆提問" });
    }

    comment.reply_content = content;
    comment.reply_at = new Date();

    await commentRepo.save(comment);

    res.status(200).json({
      status: true,
      message: "回覆成功",
      data: {
        reply_content: comment.reply_content,
        reply_at: comment.reply_at
      }
    });
  } catch (error) {
    console.error("回覆提問發生錯誤", error);
    res.status(500).json({
      status: false,
      message: "回覆提問時發生錯誤",
      error: error.message
    });
  }
}

module.exports = {
  createProject,
  createProjectPlan,
  getProject,
  updateProject,
  updateProjectPlan,
  deleteProjectPlan,
  getAllProjects,
  getAllCategories,
  getProjectOverview,
  getProjectPlans,
  getProgress,
  createProjectComment,
  sponsorProjectPlan,
  createProjectSponsorship,
  getProjectFaq,
  getProjectComment,
  getMyProjects,
  deleteProject,
  getMyAllQuestions,
  getMyProjectsQuestions,
  replyToProjectComment
};
