const jwt = require('jsonwebtoken');
const Total = require('../models/Total');
const JWT_SECRET = 'jm_shoppingmall';
const mongoose = require("mongoose");


exports.saveAccountInfo = async (req, res) => {
  const { accounts } = req.body;

  // accounts가 배열이 아닌 경우 처리
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return res.status(400).json({ success: false, message: '계좌 정보가 필요합니다.' });
  }

  try {
    // 전체 계좌 정보를 저장
    const total = new Total({
      account: accounts, // accounts 배열 전체 저장
    });

    await total.save();

    return res.status(201).json({
      success: true,
      message: '계좌 정보가 성공적으로 저장되었습니다.',
      total,
    });
  } catch (error) {
    console.error('계좌 정보 저장 오류:', error);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

