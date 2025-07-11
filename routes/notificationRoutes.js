const express = require('express');
const router = express.Router();
const { 
    createNotification, 
    getNotificationsByUser,
    readNotifications,
} = require('../controllers/notificationController');

router.use((req, res, next) => {
    next();
});

// 알림 생성
router.post('/notifications', createNotification);

// 내 알림 조회
router.get('/notifications/:userId', getNotificationsByUser);
router.patch('/notifications/:userId/read-all', readNotifications);

module.exports = router;
