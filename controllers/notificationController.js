const Notification = require('../models/Notification');
const mongoose = require('mongoose');

// 알림 생성
exports.createNotification = async (req, res) => {
  try {
    // 1. 필수 값 검증
    const { userId, message, url } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ success: false, message: 'userId와 message는 필수입니다.' });
    }

    // 2. userId 유효성
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 userId입니다.' });
    }

    // (선택) 메시지 길이, url 유효성 검사
    if (typeof message !== 'string' || message.trim().length < 1) {
      return res.status(400).json({ success: false, message: '메시지는 1자 이상이어야 합니다.' });
    }
    if (url && typeof url !== 'string') {
      return res.status(400).json({ success: false, message: 'url은 문자열이어야 합니다.' });
    }

    // 3. 저장
    const noti = await Notification.create({ userId, message, url: url || '' });
    if (!noti) {
      return res.status(500).json({ success: false, message: '알림 저장에 실패했습니다.' });
    }
    res.json({ success: true, noti });
  } catch (err) {
    res.status(500).json({ success: false, message: '알림 생성 중 서버 오류: ' + err.message });
  }
};


// 내 알림 조회
exports.getNotificationsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // 1. userId 필수, 유효성
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId가 필요합니다.' });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: '유효하지 않은 userId입니다.' });
    }

    // 2. 알림 목록 조회
    const list = await Notification.find({ userId }).sort({ createdAt: -1 });
    if (!Array.isArray(list)) {
      return res.status(500).json({ success: false, message: '알림 목록 조회에 실패했습니다.' });
    }
    res.json({ success: true, notifications: list });
  } catch (err) {
    res.status(500).json({ success: false, message: '알림 조회 중 서버 오류: ' + err.message });
  }
};

exports.readNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, message: 'userId 필요' });

    const result = await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};