const express = require('express');
const { 
    loginUser, 
    signupUser, 
    getAllUsersInfo , 
    updateUserInfo,
    deleteUser,
    getUserInfo,
    getUserInfoByid,
    loginAdmin,
    updateIsActive,
    changePassword,
    getInactiveUsersCount,
} = require('../controllers/userController');

const router = express.Router();

// 디버깅 로그 추가: 요청 경로 확인
router.use((req, res, next) => {
    next();
});
// 로그인
router.post('/login', loginUser);
router.post('/loginAdmin', loginAdmin);
// 회원가입
router.post('/signup', signupUser);
//모든 유저 정보 조회
router.get('/userinfo', getAllUsersInfo );
//아이디를 통해 유저 조회
router.get('/userinfoget', getUserInfo );
//유저 정보 조회
router.get('/userinfo/:id',  getUserInfoByid);
//유저 수정
router.put('/userinfo/:id', updateIsActive );
router.get('/inactiveUsersCount', getInactiveUsersCount);
router.put('/changePassword', changePassword);
router.put('/userinfoUpdate', updateUserInfo );
//유저 삭제
router.delete('/userinfo/:id', deleteUser );


module.exports = router;
