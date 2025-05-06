const express = require('express');
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger");
const appError = require('../utils/appError');  

async function getProject(req, res, next){
    const projectId = parseInt(req.params.project_id, 10);
    try{
        const projectRepository = dataSource.getRepository("Projects");
        const project = await projectRepository.findOne({
            where:{id: projectId},
            relations: ["projectPlans"]
        });
        if (!project){
            return next(appError(404, '無此專案'));
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
            project_plans:plans
        };
        res.status(200).json({
            status: true,
            data: responseData
        })

    }catch(error){
        logger.error('獲取專案資料失敗', error);
        next(error);
    }
};

module.exports = {
    getProject
}
