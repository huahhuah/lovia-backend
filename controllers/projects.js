const express = require('express');
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger")("Projects");;
const appError = require('../utils/appError');  

async function createproject(req, res, next) {
    try {
      const createProjectRepository = dataSource.getRepository("CreateProjects");  
    
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
    
      // 必填欄位檢查
      const missingFields = [];
      if (!title) missingFields.push("title");
      if (!summary) missingFields.push("summary");
      if (!category) missingFields.push("category");
      if (!total_amount) missingFields.push("total_amount");
      if (!start_time) missingFields.push("start_time");
      if (!end_time) missingFields.push("end_time");
      if (!cover) missingFields.push("cover");
      if (!full_content) missingFields.push("full_content");
      if (!project_team) missingFields.push("project_team");
      if (!plan_name) missingFields.push("plan_name");
      if (!amount) missingFields.push("amount");
      if (!quantity) missingFields.push("quantity");
      if (!feedback) missingFields.push("feedback");
      if (!feedback_img) missingFields.push("feedback_img");
      if (!delivery_date) missingFields.push("delivery_date");
  
      if (missingFields.length > 0) {
        return res.status(400).json({
          status: false,
          message: `缺少必要欄位: ${missingFields.join(", ")}`
        });
      }
    
      // 創建新的專案
      const newProject = createProjectRepository.create({
        //user,//: { id: user_id },  // 關聯到 Users 表
        category,//: { id: category },  // 關聯 category
        title,
        summary,
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
      });
    
      // 儲存專案到資料庫
      const savedProject = await createProjectRepository.save(newProject);
    
      res.status(200).json({
        status: true,
        message: "新增成功，請填寫募資方案",
        data: {
          project_id: savedProject.id
        }
      });
    
    } catch (err) {
        console.error("🔥 欄位填寫不完整或有誤：", err);
        logger.error("欄位填寫不完整或有誤", err);
        res.status(400).json({
          status: "error",
          message: err.message || "欄位填寫不完整或有誤",
        });
      }
    }

async function getProject(req, res, next){
    const projectId = parseInt(req.params.project_id, 10);
    try{
        const projectRepository = dataSource.getRepository("Projects");
        const project = await projectRepository.findOne({
            where:{id: projectId},
            relations: ["projectPlans"]
        });
        if (!project){
            return next(appError(404, '�L���M��'));
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
        })

    }catch(error){
        logger.error('����M�׸�ƥ���', error);
        next(error);
    }
};

module.exports = {
    getProject,
    createproject
}
