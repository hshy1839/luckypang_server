const jwt = require('jsonwebtoken');
const  Coupon  = require('../models/Coupon'); // Coupon 모델로 변경
const JWT_SECRET = 'jm_shoppingmall';
const mongoose = require('mongoose');

// 쿠폰 생성
exports.createCoupon = async (req, res) => {
    try {
        // JWT 토큰 확인
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

        if (!decoded || !decoded.userId) {
            return res.status(401).json({ success: false, message: 'Token does not contain userId' });
        }

        // 요청 데이터에서 쿠폰 정보 추출
        const { name, code, discountType, discountValue, validFrom, validUntil, applicableCategories } = req.body;

        const coupon = new Coupon({
            name,
            code,
            discountType,
            discountValue,
            validFrom,
            validUntil,
            applicableCategories,
        });

        const createdCoupon = await coupon.save();

        return res.status(200).json({
            success: true,
            coupon: createdCoupon,
        });
    } catch (err) {
        console.error('쿠폰 생성 실패:', err);
        return res.status(500).json({
            success: false,
            message: '쿠폰 생성 중 오류가 발생했습니다.',
            error: err.message,
        });
    }
};

// 모든 쿠폰 조회
exports.getAllCoupons = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
        }

        jwt.verify(token, JWT_SECRET);

        const coupons = await Coupon.find();
        if (!coupons || coupons.length === 0) {
            return res.status(404).json({ success: false, message: '쿠폰을 찾을 수 없습니다.' });
        }

        res.status(200).json({
            success: true,
            totalCoupons: coupons.length,
            coupons: coupons,
        });
    } catch (err) {
        console.error('모든 쿠폰 조회 실패:', err);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 특정 쿠폰 조회
exports.getCoupon = async (req, res) => {
    const { id } = req.params;

    console.log('요청 ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
        console.error('유효하지 않은 쿠폰 ID:', id);
        return res.status(400).json({ success: false, message: '유효하지 않은 쿠폰 ID입니다.' });
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            console.error('토큰 누락: 인증 실패');
            return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
        }

        jwt.verify(token, JWT_SECRET);

        const coupon = await Coupon.findById(id);
        if (!coupon) {
            console.error('쿠폰 없음:', id);
            return res.status(404).json({ success: false, message: '쿠폰을 찾을 수 없습니다.' });
        }

        return res.status(200).json({ success: true, coupon });
    } catch (err) {
        console.error('쿠폰 조회 중 오류:', err);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 쿠폰 삭제
exports.deleteCoupon = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: '유효하지 않은 쿠폰 ID입니다.' });
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
        }

        jwt.verify(token, JWT_SECRET);

        const deletedCoupon = await Coupon.findByIdAndDelete(id);
        if (!deletedCoupon) {
            return res.status(404).json({ success: false, message: '쿠폰을 찾을 수 없습니다.' });
        }

        return res.status(200).json({
            success: true,
            message: '쿠폰이 삭제되었습니다.',
        });
    } catch (err) {
        console.error('쿠폰 삭제 실패:', err);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 쿠폰 업데이트
exports.updateCoupon = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: '유효하지 않은 쿠폰 ID입니다.' });
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
        }

        jwt.verify(token, JWT_SECRET);

        const updatedCoupon = await Coupon.findByIdAndUpdate(id, updates, { new: true });
        if (!updatedCoupon) {
            return res.status(404).json({ success: false, message: '쿠폰을 찾을 수 없습니다.' });
        }

        return res.status(200).json({
            success: true,
            coupon: updatedCoupon,
        });
    } catch (err) {
        console.error('쿠폰 업데이트 실패:', err);
        return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
};

// 쿠폰 코드 검증
exports.verifyCoupon = async (req, res) => {
    const code = req.query.code; // 쿼리 매개변수에서 쿠폰 코드 가져오기

    if (!code) {
        return res.status(400).json({ success: false, message: '쿠폰 코드가 제공되지 않았습니다.' });
    }

    try {
        const coupon = await Coupon.findOne({ code: code }); // 코드로 쿠폰 조회
        if (coupon) {
            return res.status(200).json({
                success: true,
                message: '유효한 쿠폰입니다.',
                discountValue: coupon.discountValue,
                discountType: coupon.discountType,
                name: coupon.name,
            });
        } else {
            return res.status(404).json({
                success: false,
                message: '유효하지 않은 쿠폰 코드입니다.',
            });
        }
    } catch (err) {
        console.error('쿠폰 코드 검증 실패:', err);
        return res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: err.message,
        });
    }
};
