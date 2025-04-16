const jwt = require('jsonwebtoken');
const Point = require('../models/Point');
const JWT_SECRET = 'jm_shoppingmall';
const mongoose = require("mongoose");

const calculateTotalPoint = async (userId) => {
    const points = await Point.find({ user: userId });
    return points.reduce((acc, p) => {
      if (p.type === '추가' || p.type === '환불') return acc + p.amount;
      if (p.type === '감소') return acc - p.amount;
      return acc;
    }, 0);
  };

  
// 포인트 내역 추가
exports.createPoint = async (req, res) => {
    try {
      const token = req.headers['authorization']?.split(' ')[1];
      if (!token) return res.status(403).json({ success: false, message: 'Token is required' });
  
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded?.userId) return res.status(401).json({ success: false, message: 'Invalid token' });
  
      const { type, amount, description, relatedOrder, targetUserId } = req.body;
      if (!targetUserId || !['추가', '감소', '환불'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid input' });
      }
  
      // 현재 누적 포인트 계산
      const previousTotal = await calculateTotalPoint(targetUserId);
  
      // 새로운 포인트 적용
      let newTotal = previousTotal;
      if (type === '추가' || type === '환불') newTotal += Number(amount);
      if (type === '감소') newTotal -= Number(amount);
  
      const point = new Point({
        user: targetUserId,
        type,
        amount,
        description,
        relatedOrder: relatedOrder || null,
        totalAmount: newTotal, // 누적 포인트 저장
        createdAt: new Date(),
      });
  
      const createdPoint = await point.save();
  
      return res.status(200).json({
        success: true,
        point: createdPoint,
        totalAmount: newTotal,
      });
    } catch (err) {
      console.error('포인트 등록 실패:', err);
      return res.status(500).json({ success: false, message: '서버 오류', error: err.message });
    }
  };

exports.getPointsByUserId = async (req, res) => {
    try {
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

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid user ID format' });
        }

        const points = await Point.find({ user: id })
            .populate('user', 'nickname email')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            points,
        });
    } catch (err) {
        console.error('포인트 내역 조회 실패:', err);
        return res.status(500).json({
            success: false,
            message: '포인트 내역 조회 중 오류가 발생했습니다.',
            error: err.message,
        });
    }
};

// 포인트 내역 수정
exports.updatePoint = async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            return res.status(403).json({ success: false, message: 'Token is required' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            console.error('Token verification failed:', err);
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }

        const { id } = req.params;
        const { type, amount, description, relatedOrder } = req.body;

        const updatedPoint = await Point.findByIdAndUpdate(
            id,
            {
                type,
                amount,
                description,
                relatedOrder: relatedOrder || null,
            },
            { new: true }
        );

        if (!updatedPoint) {
            return res.status(404).json({ success: false, message: '포인트 내역을 찾을 수 없습니다.' });
        }

        return res.status(200).json({
            success: true,
            point: updatedPoint,
        });
    } catch (err) {
        console.error('포인트 내역 수정 실패:', err);
        return res.status(500).json({
            success: false,
            message: '포인트 수정 중 오류가 발생했습니다.',
            error: err.message,
        });
    }
};

// 포인트 내역 삭제
exports.deletePoint = async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            return res.status(403).json({ success: false, message: 'Token is required' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            console.error('Token verification failed:', err);
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }

        const { id } = req.params;

        const deleted = await Point.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ success: false, message: '포인트 내역을 찾을 수 없습니다.' });
        }

        return res.status(200).json({
            success: true,
            message: '포인트 내역이 삭제되었습니다.',
        });
    } catch (err) {
        console.error('포인트 내역 삭제 실패:', err);
        return res.status(500).json({
            success: false,
            message: '포인트 삭제 중 오류가 발생했습니다.',
            error: err.message,
        });
    }
};
