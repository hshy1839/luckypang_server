// routes/noticeRoutes.js
const express = require('express');
const router = express.Router();
const { upload } = require('../middlewares/upload');
const {
  createNotice, getAllNotices, getNoticeById, updateNotice, deleteNotice
} = require('../controllers/noticeController');

router.post('/notice', upload.fields([{ name: 'noticeImage', maxCount: 10 }]), createNotice);
router.get('/notice', getAllNotices);
router.get('/notice/:id', getNoticeById);
router.put('/notice/:id', upload.fields([{ name: 'noticeImage', maxCount: 10 }]), updateNotice);
router.delete('/notice/:id', deleteNotice);

module.exports = router;
