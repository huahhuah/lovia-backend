const express = require("express");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Projects");
const appError = require("../utils/appError");
const jwt = require("jsonwebtoken");

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
      project_type: end_time === "9999-12-31" ? "長期贊助" : "募資中",
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
      relations: ["projectPlans"]
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
      faq: project.faq || [],
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
    console.log("user:", req.user);
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
      category_id,
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
    if (total_amount !== undefined) project.total_amount = Number(total_amount);
    if (start_time !== undefined) project.start_time = start_time;
    if (end_time !== undefined) project.end_time = end_time;
    if (cover !== undefined) project.cover = cover;
    if (full_content !== undefined) project.full_content = full_content;
    if (project_team !== undefined) project.project_team = project_team;
    if (faq !== undefined) project.faq = faq;

    if (Array.isArray(req.body.plans)) {
      // 刪除原來plan陣列
      await planRepo.delete({ project: { id: projectId } });
      // 建立新的plan陣列
      const newPlans = req.body.plans.map(plan => {
        return planRepo.create({
          plan_name: plan.plan_name,
          amount: Number(plan.amount),
          quantity: plan.quantity ? Number(plan.quantity) : 0,
          feedback: plan.feedback,
          feedback_img: plan.feedback_img,
          delivery_date: plan.delivery_date,
          project
        });
      });
      await planRepo.save(newPlans);
    }
    const updateProject = await projectRepo.save(project);
    res.status(200).json({
      status: true,
      data: { project_id: updateProject.id }
    });
  } catch (error) {
    logger.error("更新失敗", error);
    next(error);
  }
}

// 查詢所有專案（探索用：支援 filter、分類、分頁、排序、格式化）
const { Between, Not, IsNull } = require("typeorm");
const Fund_usages = require("../entities/Fund_usages");

async function getAllProjects(req, res, next) {
  try {
    await updateExpiredProjects();
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

    const qb = projectRepo
      .createQueryBuilder("project")
      .leftJoinAndSelect("project.category", "category")
      .leftJoinAndSelect("project.user", "user")
      .skip((page - 1) * perPage)
      .take(perPage);

    // 篩選條件
    if (categoryId) {
      qb.andWhere("project.category_id = :categoryId", { categoryId });
    }

    if (keyword) {
      qb.andWhere("project.title ILIKE :kw OR project.summary ILIKE :kw", {
        kw: `%${keyword}%`
      });
    }

    switch (filter) {
      case "recent":
        qb.andWhere("project.is_finished = false").andWhere(
          "project.end_time BETWEEN :today AND :next70Days",
          { today, next70Days }
        );
        break;

      case "funding":
        qb.andWhere("project.is_finished = false").andWhere(
          "(project.project_type IS NULL OR project.project_type != '長期贊助')"
        );
        break;

      case "long":
        qb.andWhere("project.project_type = '長期贊助'");
        break;

      case "archived":
        qb.andWhere("project.is_finished = true");
        break;

      case "popular":
        qb.andWhere("project.is_finished = false");
        break;

      case "all":
      default:
        qb.andWhere("project.is_finished = false");
        break;
    }

    // 排序
    if (filter === "popular") {
      qb.orderBy("project.amount", "DESC");
    } else if (filter === "recent") {
      qb.orderBy("project.end_time", "ASC");
    } else {
      qb.orderBy("project.created_at", sort === "oldest" ? "ASC" : "DESC");
    }

    const [projects, total] = await qb.getManyAndCount();

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
        category_name: p.category?.name || "未分類"
      };
    });

    async function getAllCategories(req, res, next) {
      try {
        const categoryRepo = dataSource.getRepository("Categories");
        const categories = await categoryRepo.find();

        res.status(200).json({
          status: true,
          message: "分類列表取得成功",
          data: categories
        });
      } catch (error) {
        console.error("取得分類失敗：", error);
        res.status(500).json({
          status: false,
          message: "伺服器錯誤，無法取得分類"
        });
      }
    }

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
    console.error("取得專案失敗：", error);
    logger.warn("取得專案失敗", error);
    next(error);
  }
}
//查詢所有分類
async function getAllCategories(req, res, next) {
  try {
    const categoryRepo = dataSource.getRepository("Categories");
    const categories = await categoryRepo.find();

    res.status(200).json({
      status: true,
      message: "分類列表取得成功",
      data: categories
    });
  } catch (error) {
    console.error(" 取得分類失敗：", error);
    res.status(500).json({
      status: false,
      message: "伺服器錯誤，無法取得分類"
    });
  }
}

// 查詢專案概覽
async function getProjectOverview(req, res, next) {
  const projectId = parseInt(req.params.projectId);

  if (isNaN(projectId) || projectId < 1) {
    return next(appError(400, "無效的查詢參數"));
  }

  try {
    const projectRepo = dataSource.getRepository("Projects");
    const userRepo = dataSource.getRepository("Users");

    // 查詢 project 本身資料（需包含 category、user 等關聯）
    const project = await projectRepo.findOne({
      where: { id: projectId },
      relations: ["category", "user"] // 假設關聯設為 category 與 user（提案人）
    });

    if (!project) {
      return next(appError(404, "找不到該專案"));
    }

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
        category: project.category.name, // 取分類名稱
        total_amount: project.total_amount,
        current_amount,
        progress_percent,
        start_time: project.start_time,
        end_time: project.end_time,
        remaining_days,
        proposer: project.user.username, // 提案者名稱
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

//自動更新過期專案狀態
async function updateExpiredProjects() {
  const projectRepo = dataSource.getRepository("Projects");
  const today = new Date();

  // 取得所有還沒結束的募資中、長期贊助
  const activeProjects = await projectRepo.find({
    where: [
      { is_finished: false, project_type: "募資中" },
      { is_finished: false, project_type: "長期贊助" }
    ]
  });

  for (const project of activeProjects) {
    if (project.end_time !== "9999-12-31" && new Date(project.end_time) < today) {
      project.project_type = "歷年專案";
      project.is_finished = true;
      await projectRepo.save(project); // 個別儲存更新
    }
  }
}

// 取得進度
async function getProgress(req, res, next){
    try {
      const { project_id } = req.params;
      if (!project_id){
        return next(appError(400,'請求錯誤'));
      }
      const progressRepository = dataSource.getRepository("ProjectProgresses");
      const progresses = await progressRepository.find({
        where: {project_id},
        order: {date: "DESC"},
        relations:{
          fundUsages:{
            status: true
          }
        }
      });

      const result = progresses.map(progress => {
        const allUsage = (progress.fundUsages || []).map(usage =>({
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
        }
      });
      res.status(200).json({
        status: true,
        message: '成功取得進度分享',
        data: result
      });
    } catch (error){
      logger.error('取得進度資料失敗', error);
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
  updateExpiredProjects,
  getProgress
};
