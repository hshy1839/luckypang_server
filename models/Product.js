const mongoose = require('mongoose');

// 상품 스키마 정의
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },         // 상품 이름
  category: {                                     // 카테고리 (상위 및 하위)
    main: { type: String, required: true },       // 상위 카테고리 (예: 의류, 액세서리 등)
    sub: { type: String, required: true },        // 하위 카테고리 (예: 셔츠, 바지 등)
  },  // 카테고리 (예: 의류, 액세서리 등)
  main_image: { type: String },                   // 이미지 URL (이미지 링크 또는 S3 링크 등)
  createdAt: { type: Date, default: Date.now },   // 상품 생성 날짜
  price: { type: Number, required: true },        // 가격
  description: { type: String },
  mainImage: [{type: String}],      
  additionalImages: [{ type: String }],                    
  sizeStock: {  // 사이즈별 재고
    S: { type: Number, default: 0 },
    M: { type: Number, default: 0 },
    L: { type: Number, default: 0 },
    XL: { type: Number, default: 0 },
    free : {type: Number, default : 0},
  },
});

// 상품 모델 생성
const Product = mongoose.model('Product', productSchema);

module.exports = { Product };
