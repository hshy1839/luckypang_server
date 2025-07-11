  const mongoose = require('mongoose');

  // 상품 스키마 정의

  const productSchema = new mongoose.Schema({
    // 기본 정보
    productNumber: { type: String, unique: true, required: true }, // 상품번호 (ex. P20240414001)
    name: { type: String, required: true },
    brand: { type: String },
    category: { type: String }, // ex. 디지털/가전, 식품, 화장품 등
  
    // 상태 관련
    isVisible: { type: Boolean, default: true }, // 노출 여부
    statusDetail: { type: String, enum: ['판매중', '테스트', '품절', '비노출'], default: '판매중' },
  
    // 확률 (ex. 5천원 박스 전용)
    probability: { type: String }, // ex. '5000_box', '10000_box'
  
    // 이미지
    mainImage: { type: String }, // 대표 이미지 (단일)
    additionalImages: [{ type: String }], // 상세 이미지
  
    // 가격 관련
    consumerPrice: { type: Number, required: true }, // 소비자가
    price: { type: Number, required: true }, // 실구매가
    shippingFee: { type: Number, default: 0 }, // 배송비
    totalPrice: { type: Number }, // 실결제가 (price + shippingFee) - 후처리로 계산 가능
  
    // 배송 관련
  
    refundProbability: { type: String },
  
    // 설명
    description: { type: String },
  
    // 외부 링크
    sourceLink: { type: String }, // 발주처 링크
    isSourceSoldOut: { type: Boolean, default: false }, // 발주처 품절 여부
  
    // 메타
    createdAt: { type: Date, default: Date.now },
  });
  

  // 상품 모델 생성
  const Product = mongoose.model('Product', productSchema);

  module.exports = {Product};
