const express = require("express");
const router = express.Router();
const config = require("../config");
const { dataSource } = require("../db/data-source");
const logger = require("../utils/logger");
const generateJWT = require("../utils/generateJWT");
const jwtSecret = config.get("secret").jwtSecret;
const appError = require("../utils/appError");

async function getAllUsers(req, res, next){

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
        order: { created_at: "DESC"}
    })
    const result = {
        data: users,
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
        data: result
    })
}

module.exports = {
    getAllUsers,
}