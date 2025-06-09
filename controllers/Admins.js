const express = require("express");
const router = express.Router();
const config = require("../config");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger");
const generateJWT = require("../utils/generateJWT");
const jwtSecret = config.get("secret").jwtSecret;
const appError = require("../utils/appError");
const Proposer_statuses = require("../entities/Proposer_statuses");

// 取得所有使用者資料
async function getAllUsers(req, res, next){
    try{
        const { page = 1 } = req.query; // 預設
        const currentPage = Math.max(parseInt(page, 10) ||1,1);
        const pageSize = 10; // 一頁10筆資料
        if(!(req.user.role_id === 3)){
            return next(appError(401,'你沒有察看的權限'))
        }

        const userRepo = dataSource.getRepository("Users");
        const [users, total] = await userRepo.findAndCount({
            skip: (currentPage -1) *pageSize,
            take: pageSize,
            order: { created_at: "ASC"},
            relations: ["gender", "role", "status"]
        })
        const usefulInfo = users.map( user => ({
            id: user.id,
            account: user.account,
            username: user.username,
            phone: user.phone,
            birthday: user.birthday,
            gender: user.gender?.gender || null,
            created_at: user.created_at,
            role: user.role?.role_type || null,
            status: user.status?.status || null
        }))
        const result = {
            data: usefulInfo,
            pagination: {
                total, 
                currentPage,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        }
        res.status(200).json({
            status: true,
            message: '查詢成功',
            data: {
                result
            }
        })
    } catch (error) {
        next (error);
    }
}

// 取得會員詳情
async function getUsersInfo(req, res, next){
    const { user_id } = req.params;
    console.log(user_id);
    if(req.user.role_id !== 3){
        return next(appError(401, '你沒有察看的權限'));
    }
    try{
        const userRepo = dataSource.getRepository("Users");
        const userInfo = await userRepo.findOne({
            where: { id: user_id },
            relations: ["role","gender","status"]
        });
        res.status(200).json({
            status: true,
            message: '成功取得使用者資料',
            data: userInfo
        });
    } catch (error){
        next(error);
    }

}

// 取得募資者轉提案者的申請表
async function getProposerApplication(req, res, next){
    try{
        if(req.user.role_id !== 3){
            return next(appError(401, '你沒有查看的權限'));
        }
        const proposerRepo = dataSource.getRepository("Proposers");
        const result = await proposerRepo.find({
            where: {status : 1},
            relations: ["user", "proposerStatuses"]
        });
        res.status(200).json({
            status: true,
            message: '成功取得申請資料',
            data: result
        })
    } catch(error) {
        next(error);
    }
}

// 修改募資者轉提案者
async function patchProposerStatus(req, res, next){
    const payload = req.body;
    if(!Array.isArray(payload)){
        return next(appError(400, '傳入資料格式有誤'));
    }
    try {
        const userRepo = dataSource.getRepository("Users");
        const proposerRepo = dataSource.getRepository("Proposers");

        for (const item of payload){
            const { user_id, new_status} = item;
            const status_id = parseInt(new_status, 10);
            
            if (new_status === "2"){
                await userRepo.update(
                    { id: user_id },
                    { role_id:2 }
                );
            }
            
            await proposerRepo.update(
                { user_id },
                {
                    status: status_id,
                    updated_at: new Date()
                });
            }
            res.status(200).json({
                status: true,
                message: '修改成功',
            })
        } catch(error){
            next (error)
        }
}

module.exports = {
    getAllUsers,
    getUsersInfo,
    getProposerApplication,
    patchProposerStatus
}