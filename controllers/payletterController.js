  const jwt = require('jsonwebtoken');
  const mongoose = require('mongoose');
  const axios = require('axios');
  const { User } = require('../models/User');

  const JWT_SECRET = 'jm_shoppingmall';

  const PAYLETTER_API_KEY = 'MzAyQTQxRDQ3NkQ4OTE2ODA4MjcwNUJDNTlBMkU3MEE=';
const PAYLETTER_CLIENT_ID = 'sales_test';
const PAYLETTER_ENDPOINT = 'https://testpgapi.payletter.com/v1.0/payments/request';



exports.requestPayletterPayment = async function (req, res) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ code: 401, message: '토큰이 없습니다.' });
      }
  
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId;

      const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: '유저를 찾을 수 없습니다.' });
    }
  
      const { amount, productName = '럭키박스', boxId } = req.body;
  
      if (!amount || typeof amount !== 'number') {
        return res.status(400).json({ code: 400, message: '결제 금액이 유효하지 않습니다.' });
      }
  
      const orderNo = 'order_' + Date.now();
  
      const payload = {
        pgcode: 'creditcard',
        client_id: PAYLETTER_CLIENT_ID,
        user_id: userId,
        user_name: user.nickname,  // ✅ 반드시 문자열로 포함
        order_no: orderNo,
        amount: amount,
        product_name: productName,
        return_url: 'https://125.248.164.45:7778/payment-result',
        callback_url: 'https://125.248.164.45:7778/api/payletter/callback',
        custom_parameter: JSON.stringify({ boxId: boxId })
      };
  
      console.log('📦 페이레터로 전송할 payload:');
      console.log(JSON.stringify(payload, null, 2));  // ✅ 실제 전송 내용 로그
  
      const result = await axios({
        method: 'post',
        url: PAYLETTER_ENDPOINT,
        headers: {
          Authorization: 'PLKEY ' + PAYLETTER_API_KEY,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify(payload)  // ✅ 반드시 stringify
      });
  
  
      res.status(200).json({
        code: 200,
        message: '결제 URL 생성 성공',
        data: {
          paymentUrl: result.data.online_url,
          orderNo: orderNo
        }
      });
  
    } catch (err) {
      console.error('💥 결제 요청 오류 발생');
  
      if (err.response) {
        console.error('📡 Payletter 응답 코드:', err.response.status);
        console.error('📡 Payletter 응답 본문:', err.response.data);
      } else if (err.request) {
        console.error('📡 요청은 보냈으나 응답이 없습니다:', err.request);
      } else {
        console.error('📛 일반 에러 메시지:', err.message);
      }
  
      console.error('📛 에러 전체 스택:', err.stack);
  
      res.status(500).json({
        code: 500,
        message: '결제 요청 실패',
        error: err.message,
        detail: err.response?.data || null
      });
    }
  };
  

exports.handleCallback = async (req, res) => {
    try {
      const {
        client_id,
        order_no,
        payment_result,
        user_id,
        amount,
        custom_parameter // boxId 등 추가 정보
      } = req.body;
  
      if (payment_result !== 'paid') {
        return res.status(400).json({ success: false, message: '결제 실패 또는 취소됨' });
      }
  
      // 이미 주문이 있는지 확인 (중복 방지)
      const existing = await Order.findOne({ externalOrderNo: order_no });
      if (existing) {
        return res.status(200).json({ success: true, message: '이미 처리된 주문' });
      }
  
      // boxId 같은 정보는 custom_parameter로 전달
      const parsed = custom_parameter ? JSON.parse(custom_parameter) : {};
      const boxId = parsed.boxId;
      if (!boxId) return res.status(400).json({ success: false, message: 'boxId 누락' });
  
      const box = await Box.findById(boxId);
      if (!box) return res.status(404).json({ success: false, message: '박스를 찾을 수 없음' });
  
      // 유저 정보
      const user = await User.findById(user_id);
      if (!user) return res.status(404).json({ success: false, message: '유저를 찾을 수 없음' });
  
      // 주문 생성
      const newOrder = new Order({
        user: user._id,
        box: box._id,
        boxCount: 1,
        paymentType: 'card',
        paymentAmount: amount,
        pointUsed: 0,
        deliveryFee: { point: 0, cash: 0 },
        status: 'paid',
        externalOrderNo: order_no
      });
  
      await newOrder.save();
  
      return res.status(200).json({
        success: true,
        message: '결제 확인 및 주문 생성 완료',
        orderId: newOrder._id
      });
  
    } catch (err) {
      console.error('💥 페이레터 콜백 오류:', err);
      return res.status(500).json({ success: false, message: '서버 오류' });
    }
  };