const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { Term } = require('../models/Term'); // Promotion 모델 import
const JWT_SECRET = 'jm_shoppingmall';


// 약관 조회
exports.getTermByCategory = async (req, res) => {
    try {
      const { category } = req.params;
  
      const term = await Term.findOne({ category });
      if (!term) {
        return res.status(404).json({
          success: false,
          message: '해당 카테고리의 약관을 찾을 수 없습니다.',
        });
      }
  
      return res.status(200).json({
        success: true,
        term,
      });
    } catch (err) {
      console.error('📛 약관 조회 실패:', err);
      return res.status(500).json({
        success: false,
        message: '약관 조회 중 오류가 발생했습니다.',
      });
    }
  };
  

// 약관 수정
exports.createTermByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      return res.status(403).json({ success: false, message: 'Token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    if (!decoded?.userId) {
      return res.status(401).json({ success: false, message: 'Token does not contain userId' });
    }

    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, message: '약관 내용이 필요합니다.' });
    }

    // 기존 항목 삭제
    await Term.deleteOne({ category });

    // 새로 생성
    const newTerm = new Term({ category, content });
    const saved = await newTerm.save();

    return res.status(201).json({
      success: true,
      term: saved,
    });
  } catch (err) {
    console.error('📛 약관 등록 실패:', err);
    return res.status(500).json({
      success: false,
      message: '약관 등록 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};
