const jwt = require('jsonwebtoken');
const Total = require('../models/Total');
const JWT_SECRET = 'jm_shoppingmall';
const mongoose = require("mongoose");

// 계좌 정보 저장
exports.saveAccountInfo = async (req, res) => {
  const { accounts } = req.body;

  // accounts가 배열이 아닌 경우 처리
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return res.status(400).json({ success: false, message: '계좌 정보가 필요합니다.' });
  }

  try {
    // Total 컬렉션의 기존 데이터를 덮어쓰기
    const updatedTotal = await Total.findOneAndUpdate(
      {}, // 조건을 비워두어 첫 번째 문서를 선택하거나 새로 생성
      { account: accounts }, // 덮어쓸 계좌 정보
      { upsert: true, new: true } // 새로 생성하거나 업데이트된 데이터를 반환
    );

    return res.status(200).json({
      success: true,
      message: '계좌 정보가 성공적으로 저장되었습니다.',
      total: updatedTotal,
    });
  } catch (error) {
    console.error('계좌 정보 저장 오류:', error);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// 계좌 정보 조회
exports.getAccountInfo = async (req, res) => {
  try {
    // Total 컬렉션에서 계좌 정보 조회
    const total = await Total.findOne({});

    if (!total) {
      return res.status(404).json({
        success: false,
        message: '등록된 계좌 정보가 없습니다.',
      });
    }

    return res.status(200).json({
      success: true,
      message: '계좌 정보가 성공적으로 조회되었습니다.',
      accounts: total.account,
    });
  } catch (error) {
    console.error('계좌 정보 조회 오류:', error);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};
