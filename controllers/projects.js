const express = require("express");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Projects");
const appError = require("../utils/appError");
const { validate } = require("uuid");
const jwt = require("jsonwebtoken");

async function createProject(req, res, next) {
  try {
    const projectRepo = dataSource.getRepository("Projects");
    const planRepo = dataSource.getRepository("ProjectPlans");
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
      plan_name,
      amount,
      quantity,
      feedback,
      feedback_img,
      delivery_date
    } = req.body;

    //  檢查必要欄位
    const missingFields = checkMissingFields(req.body);
    if (missingFields.length > 0) {
      return res.status(400).json({
        status: false,
        message: `缺少必要欄位: ${missingFields.join(", ")}`
      });
    }

    // 從 JWT 取得 user_id
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ status: false, message: "未提供有效的 token" });
    }

    // 解碼 JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ status: false, message: "無效的 token" });
    }

    const user_id = decoded.id; // 從 JWT 解碼出來的 user_id

    //  驗證 user 是否存在
    const user = await userRepo.findOneBy({ id: user_id });
    if (!user) {
      return next(appError(400, "找不到對應的使用者", next));
    }

    // 驗證 category 是否存在
    const existingCategory = await categoryRepo.findOneBy({ id: category_id });
    if (!existingCategory) {
      return next(appError(400, "無效的 category", next));
    }

    // 建立 Project
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
      user
    });
    const savedProject = await projectRepo.save(newProject);

    // ✅ 建立 ProjectPlan 並關聯 Project
    const newPlan = planRepo.create({
      plan_name,
      amount,
      quantity,
      feedback,
      feedback_img,
      delivery_date,
      project: savedProject
    });
    await planRepo.save(newPlan);

    // 成功回傳
    res.status(200).json({
      status: true,
      message: "新增成功，請填寫募資方案",
      data: {
        project_id: savedProject.id
      }
    });
  } catch (err) {
    logger.error("新增專案失敗", err);
    next(appError(400, err.message || "欄位填寫不完整或有誤", next));
  }
}

// 檢查缺少欄位
function checkMissingFields(body) {
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
    "plan_name",
    "amount",
    "quantity",
    "feedback",
    "feedback_img",
    "delivery_date"
  ];
  return requiredFields.filter(field => !body[field]);
}

async function getProject(req, res, next) {
  const projectId = parseInt(req.params.project_id, 10);
  try {
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

module.exports = {
  getProject,
  createProject
};
