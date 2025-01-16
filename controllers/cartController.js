const jwt = require('jsonwebtoken');
const  Cart  = require('../models/Cart'); // Cart 모델
const JWT_SECRET = 'jm_shoppingmall';
const mongoose = require("mongoose");

exports.addToCart = async (req, res) => {
  try {
    // 요청 헤더에서 Authorization 토큰 추출
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      return res.status(403).json({ success: false, message: 'Token is required' });
    }

    // JWT 토큰 검증
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error('Token verification failed:', err);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // decoded에서 userId 확인
    const userId = decoded?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Token does not contain userId' });
    }

    // 클라이언트에서 받은 productId와 userId를 ObjectId로 변환
    const { productId, sizes, price } = req.body; // 상품 ID, 사이즈, 가격
    const productIdObjectId = new mongoose.Types.ObjectId(productId);  // productId를 ObjectId로 변환
    const userIdObjectId = new mongoose.Types.ObjectId(userId); // userId를 ObjectId로 변환

    // 장바구니 데이터 검증
    if (!productId || !sizes || sizes.length === 0) {
      return res.status(400).json({ success: false, message: '상품 ID와 사이즈를 선택해야 합니다.' });
    }

    // 장바구니에 이미 상품이 있는지 확인
    const existingCart = await Cart.findOne({
      userId: userIdObjectId,  // ObjectId로 비교
      productId: productIdObjectId, // ObjectId로 비교
    });

    // 기존 장바구니에 같은 상품이 있는 경우
    if (existingCart) {
      // 사이즈 및 수량 업데이트
      updateCartSizes(existingCart, sizes, price);

      await existingCart.save(); // 장바구니 저장
      return res.status(200).json({ success: true, message: '장바구니에 상품이 추가되었습니다.' });
    } else {
      // 새 장바구니 항목 생성
      const newCartItem = new Cart({
        userId: userIdObjectId, // ObjectId로 저장
        productId: productIdObjectId, // ObjectId로 저장
        productName: req.body.productName, // productName 추가
        sizes,
        price,
        totalPrice: calculateTotalPrice(sizes, price),
      });

      await newCartItem.save(); // 장바구니 저장
      return res.status(200).json({
        success: true,
        message: '장바구니에 상품이 추가되었습니다.',
      });
    }
  } catch (err) {
    console.error('장바구니에 상품 추가 실패:', err);

    // 중복 키 에러 처리 (예: 상품이 이미 장바구니에 있는 경우)
    if (err.code === 11000) {
      const duplicatedField = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `이미 장바구니에 담긴 상품이 있습니다.`,
      });
    }

    // 기타 오류 처리
    return res.status(500).json({
      success: false,
      message: '장바구니 추가 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
};



// 장바구니 사이즈 및 수량 업데이트
const updateCartSizes = (existingCart, sizes, price) => {
  sizes.forEach(sizeData => {
    const existingSize = existingCart.sizes.find(size => size.size === sizeData.size);
    if (existingSize) {
      existingSize.quantity += sizeData.quantity; // 기존 수량에 추가
    } else {
      existingCart.sizes.push(sizeData); // 새로운 사이즈 추가
    }
  });

  // 장바구니의 총 금액 재계산
  existingCart.totalPrice = calculateTotalPrice(existingCart.sizes, price);
};

// 장바구니 총 금액 계산
const calculateTotalPrice = (sizes, price) => {
  return sizes.reduce((total, sizeData) => {
    return total + (sizeData.quantity * price);
  }, 0);
};

// 특정 제품 조회
exports.getCartInfo = async (req, res) => {
    const { userId } = req.params; // URL 경로 파라미터에서 userId 받기


    if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('유효하지 않은 userId:', userId);
        return res.status(400).json({ success: false, message: '유효하지 않은 사용자 ID입니다.' });
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.error('토큰 누락: 인증 실패');
            return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        // 사용자 ID로 모든 장바구니 항목 찾기
        const carts = await Cart.find({ userId: new mongoose.Types.ObjectId(userId) });

        if (carts.length === 0) {
            console.error('사용자 장바구니 없음:', userId);
            return res.status(404).json({ success: false, message: '장바구니를 찾을 수 없습니다.' });
        }

        // 모든 장바구니 항목을 콘솔에 출력

        // 모든 장바구니 정보를 클라이언트에 반환
        return res.status(200).json({ success: true, carts });
    } catch (err) {
        console.error('장바구니 조회 중 오류:', err);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 장바구니에서 특정 상품 삭제
exports.deleteCart = async (req, res) => {
  try {
    // 요청 헤더에서 Authorization 토큰 추출
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
      return res.status(403).json({ success: false, message: 'Token is required' });
    }

    // JWT 토큰 검증
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.error('Token verification failed:', err);
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // decoded에서 userId 확인
    const userId = decoded?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Token does not contain userId' });
    }

    // 요청 파라미터에서 cartId 추출
    const { id } = req.params;  // :id를 받아옴
    if (!id) {
      return res.status(400).json({ success: false, message: 'cartId is required' });
    }

    // cartId가 유효한 ObjectId인지 확인
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid cartId' });
    }

    // 해당 사용자와 관련된 장바구니 항목을 찾아 삭제
    const deletedCartItem = await Cart.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(userId), // 사용자 확인
    });

    if (!deletedCartItem) {
      return res.status(404).json({ success: false, message: 'Cart item not found or you are not authorized to delete it' });
    }

    // 삭제 성공 메시지 반환
    return res.status(200).json({
      success: true,
      message: 'Cart item has been successfully deleted',
    });
  } catch (err) {
    console.error('장바구니 상품 삭제 중 오류:', err);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: err.message,
    });
  }
};

