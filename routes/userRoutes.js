const express = require('express');
const { 
    loginUser, 
    signupUser, 
    socialLogin,
    getAllUsersInfo , 
    updateUserInfo,
    deleteUser,
    getUserInfo,
    getUserInfoByid,
    loginAdmin,
    updateIsActive,
    changePassword,
    getInactiveUsersCount,
    getUserInfoByField,
    checkDuplicate,
    checkReferralCode,
    uploadProfileImage,
    resetPassword,
    verifyBootpayAuth,
    findEmailByPhone,

} = require('../controllers/userController');

const router = express.Router();

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 파일의 fieldname에 따라 저장 경로를 다르게 설정
        if (file.fieldname === 'profileImage') {
            cb(null, 'uploads/profile_images/'); // mainImage는 product_main_images 폴더에 저장
        }  else {
            cb(new Error('Invalid field name'), null); // 유효하지 않은 필드명이면 에러
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // 파일명에 타임스탬프 추가
    },
});


const upload = multer({ storage: storage }).fields([
    { name: 'profileImage', maxCount: 1 },
]);

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});
// 로그인
router.post('/login', loginUser);
router.post('/loginAdmin', loginAdmin);

router.post('/social-login', socialLogin);
// 회원가입
router.post('/signup', signupUser);
//모든 유저 정보 조회
router.get('/userinfo', getAllUsersInfo );

router.get('/userCheck', getUserInfoByField );
//아이디를 통해 유저 조회
router.get('/userinfoget', getUserInfo );

router.post('/check-duplicate', checkDuplicate );

router.post('/check-referral', checkReferralCode );

//유저 정보 조회
router.get('/userinfo/:id',  getUserInfoByid);
//유저 수정
router.put('/userinfo/:id', updateIsActive );
router.get('/inactiveUsersCount', getInactiveUsersCount);
router.put('/changePassword', changePassword);
router.put('/userinfoUpdate', updateUserInfo );
//유저 삭제
router.delete('/userinfo/:id', deleteUser );
router.post('/profile', uploadProfileImage);
router.post('/bootpay/verify-auth', verifyBootpayAuth);
//비밀번호 찾기
router.post('/reset-password', resetPassword);
// 이메일 찾기
router.get('/findEmail', findEmailByPhone);


module.exports = router;
