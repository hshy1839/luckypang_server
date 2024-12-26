const express = require('express');
const { 
    loginUser, 
    signupUser, 
    getAllUsersInfo , 
    updateUserInfo,
    deleteUser,
    getUserInfo,
    getUserInfoByid
} = require('../controllers/userController');

const router = express.Router();

// 로그인
router.post('/login', loginUser);
// 회원가입
router.post('/signup', signupUser);
//모든 유저 정보 조회
router.get('/userinfo', getAllUsersInfo );
//아이디를 통해 유저 조회
router.get('/userinfoget', getUserInfo );
//유저 정보 조회
router.get('/userinfo/:id',  getUserInfoByid);
//유저 수정
router.put('/userinfo/:id', updateUserInfo );
//유저 삭제
router.delete('/userinfo/:id', deleteUser );


module.exports = router;
