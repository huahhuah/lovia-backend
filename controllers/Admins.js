const express = require("express");
const router = express.Router();
const config = require("../config");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger");
const generateJWT = require("../utils/generateJWT");
const jwtSecret = config.get("secret").jwtSecret;
const appError = require("../utils/appError");
const Proposer_statuses = require("../entities/Proposer_statuses");
const sendEmail = require("../services/email");
const Project_comments = require("../entities/Project_comments");
const { createTransport } = require("nodemailer");
const { format } = require("date-fns");
const { In } = require('typeorm');

// 取得所有使用者資料
async function getAllUsers(req, res, next) {
  try {
    const { page = 1 } = req.query; // 預設
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = 10; // 一頁10筆資料
    if (!(req.user.role_id === 3)) {
      return next(appError(401, "你沒有察看的權限"));
    }

    const userRepo = dataSource.getRepository("Users");
    const [users, total] = await userRepo.findAndCount({
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      order: { created_at: "ASC" },
      relations: ["gender", "role", "status"]
    });
    const usefulInfo = users.map(user => ({
      id: user.id,
      account: user.account,
      username: user.username,
      phone: user.phone,
      birthday: user.birthday,
      gender: user.gender?.gender || null,
      created_at: user.created_at,
      role: user.role?.role_type || null,
      status: user.status?.status || null
    }));
    const result = {
      data: usefulInfo,
      pagination: {
        total,
        currentPage,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
    res.status(200).json({
      status: true,
      message: "查詢成功",
      data: {
        result
      }
    });
  } catch (error) {
    next(error);
  }
}

// 取得會員詳情
async function getUsersInfo(req, res, next) {
  const { user_id } = req.params;
  if (req.user.role_id !== 3) {
    return next(appError(401, "你沒有察看的權限"));
  }
  try {
    const userRepo = dataSource.getRepository("Users");
    const userInfo = await userRepo.findOne({
      where: { id: user_id },
      relations: ["role", "gender", "status"]
    });
    res.status(200).json({
      status: true,
      message: "成功取得使用者資料",
      data: userInfo
    });
  } catch (error) {
    next(error);
  }
}

// 取得募資者轉提案者的申請表
async function getProposerApplication(req, res, next) {
  try {
    if (req.user.role_id !== 3) {
      return next(appError(401, "你沒有查看的權限"));
    }
    const proposerRepo = dataSource.getRepository("Proposers");
    const result = await proposerRepo.find({
      where: { status: 1 },
      relations: ["user", "proposerStatuses"]
    });
    res.status(200).json({
      status: true,
      message: "成功取得申請資料",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

// 修改募資者轉提案者
async function patchProposerStatus(req, res, next) {
  const payload = req.body;
  if (!Array.isArray(payload)) {
    return next(appError(400, "傳入資料格式有誤"));
  }
  try {
    const userRepo = dataSource.getRepository("Users");
    const proposerRepo = dataSource.getRepository("Proposers");

    for (const item of payload) {
      const { user_id, new_status, reason } = item;
      const status_id = parseInt(new_status, 10);

      if (new_status === "2") {
        await userRepo.update({ id: user_id }, { role_id: 2 });
      }

      await proposerRepo.update(
        { user_id: user_id },
        {
          status: status_id,
          reason: reason || null,
          updated_at: new Date()
        }
      );

      const proposer = await proposerRepo.findOneBy({ user_id: user_id });

      const created_at = new Date(proposer.created_at).toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });

      const user = await userRepo.findOneBy({ id: user_id });
      if (!user || !user.account) {
        console.warn(`找不到帳號 user_id=${user_id}，跳過寄信`);
        continue;
      }

      // email通知
      let subject = "申請成為提案者──審核結果通知";
      let message = "";
      if (status_id === 2) {
        message = `您好，有關您於${created_at}申請成為提案者一事，已通過審核。\n\n歡迎登入平台讓改變開始，讓夢想成真。`;
      } else if (status_id === 3) {
        message = `您好，有關您於${created_at}申請成為提案者一事，未通過審核。\n\n未通過原因：${reason || "未提供原因"}`;
      } else {
        continue;
      }

      await sendEmail({
        to: user.account,
        subject: subject,
        message
      });
    }
    res.status(200).json({
      status: true,
      message: "修改成功"
    });
  } catch (error) {
    next(error);
  }
}

// 取得提案列表
async function getAllProjects(req, res, next) {
  try {
    const { page = 1 } = req.query;
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = 10;
    const user = req.user;
    if (user.role_id !== 3) {
      return next(appError(401, "你沒有權限觀看"));
    }

    const projectRepo = dataSource.getRepository("Projects");
    const [projects, total] = await projectRepo.findAndCount({
      where: { status: In ([1,4]) },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      order: { created_at: "ASC" },
      relations: ["user", "projectPlans", "category", "follows", "projectStatus"]
    });
    const projectInfo = [];
    projects.forEach(item => {
      projectInfo.push({
        id: item.id,
        name: item.user?.username,
        email: item.user?.account,
        phone: item.user?.phone || null,
        title: item.title,
        summary: item.summary,
        category: item.category?.name,
        total_amount: item.total_amount,
        start_time: item.start_time,
        end_time: item.end_time,
        cover: item.cover,
        full_content: item.full_content,
        project_team: item.project_team,
        created_at: item.created_at,
        updated_at: item.updated_at,
        faq: item.faq,
        status_id: item.status,
        plans: item.projectPlans.map(plan => ({
          plan_name: plan.plan_name,
          plan_amount: plan.amount,
          quantity: plan.quantity,
          feedback: plan.feedback,
          delivery_date: plan.delivery_date
        }))
      });
    });
    const result = {
      data: projectInfo,
      pagination: {
        total,
        currentPage,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    };
    res.status(200).json({
      status: true,
      message: "查詢成功",
      result
    });
  } catch (error) {
    next(error);
  }
}

// 審查提案
async function patchProjectStatus(req, res, next) {
  try {
    const { projectId } = req.params;
    const { status, reason } = req.body;

    const userRepo = dataSource.getRepository("Users");
    const projectRepo = dataSource.getRepository("Projects");
    const statusRepo = dataSource.getRepository("ProjectStatuses");
    const project = await projectRepo.findOne({
      where: { id: projectId },
      relations: ["user", "projectStatus"]
    });
    if (!project) {
      return next(appError(404, "找不到提案"));
    }
    const newStatus = await statusRepo.findOne({
      where: { id: status }
    });

    if (!newStatus) {
      return next(appError(400, "無效的狀態 ID"));
    }
    project.status = status;
    project.projectStatus = newStatus;
    project.reason = reason;
    await projectRepo.save(project);

    const created_at = new Date(project.created_at).toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });

    // email通知
    if (status === 2 || status === 3) {
      let subject = "提案審核結果通知";
      let message = "";
      if (status === 2) {
        message = `您好，有關貴單位於${created_at}之「${project.title}」，已通過審核。\n\n感謝您願意與我們一起讓改變開始，讓夢想成真。`;
      } else if (status === 3) {
        message = `您好，有關貴單位於${created_at}之「${project.title}」，經審未通過。\n\n未通過原因：${reason || "未提供原因"}`;
      }
      await sendEmail({
        to: project.user.account,
        subject,
        message
      });
    }
    res.status(200).json({
      status: true,
      message: "審查完畢，資料已更新"
    });
  } catch (error) {
    next(error);
  }
}

async function getDashboardStats(req, res, next) {
  try {
    const sponsorshipRepo = dataSource.getRepository("Sponsorships");
    const projectRepo = dataSource.getRepository("Projects");
    const userRepo = dataSource.getRepository("Users");

    // 總募資金額 (只計算 paid)
    const { sum } = await sponsorshipRepo
      .createQueryBuilder("s")
      .select("SUM(s.amount)", "sum")
      .where("s.status = 'paid'")
      .getRawOne();
    const totalAmount = parseFloat(sum) || 0;

    const totalProjects = await projectRepo.count();
    const totalUsers = await userRepo.count();

    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 29);
    startDate.setHours(0, 0, 0, 0);

    // 近30天募資金額，只計算 paid
    const amountResults = await sponsorshipRepo
      .createQueryBuilder("s")
      .select("DATE_TRUNC('day', s.created_at)", "date")
      .addSelect("SUM(s.amount)", "sum")
      .where("s.created_at >= :start AND s.status = 'paid'", { start: startDate })
      .groupBy("DATE_TRUNC('day', s.created_at)")
      .orderBy("date", "ASC")
      .getRawMany();

    const userResults = await userRepo
      .createQueryBuilder("u")
      .select("DATE_TRUNC('day', u.created_at)", "date")
      .addSelect("COUNT(*)", "count")
      .where("u.created_at >= :start", { start: startDate })
      .groupBy("DATE_TRUNC('day', u.created_at)")
      .orderBy("date", "ASC")
      .getRawMany();

    const amountMap = new Map();
    amountResults.forEach(r => {
      const key = new Date(r.date).toISOString().slice(0, 10);
      amountMap.set(key, parseFloat(r.sum));
    });

    const userMap = new Map();
    userResults.forEach(r => {
      const key = new Date(r.date).toISOString().slice(0, 10);
      userMap.set(key, parseInt(r.count));
    });

    const dailyAmounts = [];
    const dailyUsers = [];
    for (let i = 29; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const key = day.toISOString().slice(0, 10);

      dailyAmounts.push(amountMap.get(key) || 0);
      dailyUsers.push(userMap.get(key) || 0);
    }

    const fundraisingCount = await projectRepo.count({ where: { project_type: "募資中" } });
    const longtermCount = await projectRepo.count({ where: { project_type: "長期贊助" } });
    const endedCount = await projectRepo.count({ where: { project_type: "歷年專案" } });

    res.json({
      totalAmount,
      totalProjects,
      totalUsers,
      dailyAmounts,
      dailyUsers,
      projectStatusCounts: [fundraisingCount, longtermCount, endedCount]
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllUsers,
  getUsersInfo,
  getProposerApplication,
  patchProposerStatus,
  getAllProjects,
  patchProjectStatus,
  getDashboardStats
};
