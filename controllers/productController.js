// controllers/productController.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Product } = require('../models/Product');
const Box = require('../models/Box/Box.js');

const { s3 } = require('../aws/s3');
const {
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const JWT_SECRET = 'jm_shoppingmall';
const S3_BUCKET = process.env.S3_BUCKET;

function computeRefundPolicy(consumerPrice) {
  if (consumerPrice < 30000) {
    return { basis: 'box', rate: 60 };
  } else if (consumerPrice < 50000) {
    return { basis: 'consumer', rate: 60 };
  } else if (consumerPrice < 200000) {
    return { basis: 'consumer', rate: 70 };
  } else {
    return { basis: 'consumer', rate: 80 };
  }
}

// ---- 공통 유틸 ----

// 프리사인 URL 발급 (기본 10분)
async function presign(key, expiresInSec = 600) {
  if (!key) return '';
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return await getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}

// S3 객체 삭제
async function deleteS3Key(key) {
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    console.log(`✅ S3 삭제 성공: s3://${S3_BUCKET}/${key}`);
  } catch (e) {
    console.warn(`⚠️ S3 삭제 경고: ${key} (${e?.name || e?.code || e?.message})`);
  }
}

// 한 제품 객체에 presign URL들을 붙여 반환
async function attachSignedUrls(productDoc, expiresInSec = 600) {
  const p = productDoc.toObject ? productDoc.toObject() : productDoc;

  p.mainImageUrl = p.mainImage ? await presign(p.mainImage, expiresInSec) : '';
  const addis = Array.isArray(p.additionalImages) ? p.additionalImages : [];
  p.additionalImageUrls = await Promise.all(addis.map(k => presign(k, expiresInSec)));

  return p;
}

// ─────────────────────────────────────────────────────
// 상품 생성 (multer-s3: req.files.*[].key 사용)
// ─────────────────────────────────────────────────────
exports.createProduct = async (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ success: false, message: 'Token is required' });

    let decoded;
    try { decoded = jwt.verify(token, JWT_SECRET); }
    catch { return res.status(401).json({ success: false, message: 'Invalid or expired token' }); }
    if (!decoded?.userId) return res.status(401).json({ success: false, message: 'Token does not contain userId' });

    // S3 key 확보
    const mainImageKey = req.files?.mainImage?.[0]?.key || '';
    const additionalImageKeys = (req.files?.additionalImages || []).map(f => f.key);

    const {
      name, brand, category, probability, consumerPrice, price, shippingFee,
      option, description, sourceLink, isSourceSoldOut,
      // refundProbability  <= ✅ 클라에서 보내더라도 무시
    } = req.body;

    const consumerPriceNum = Number(consumerPrice) || 0;
    const priceNum = Number(price) || 0;
    const shippingFeeNum = Number(shippingFee) || 0;

    // ✅ 환급 정책 계산
    const policy = computeRefundPolicy(consumerPriceNum);

    const productNumber = 'P' + Date.now();

    const product = new Product({
      productNumber,
      name,
      brand,
      category,
      probability,
      consumerPrice: consumerPriceNum,
      price: priceNum,
      shippingFee: shippingFeeNum,
      totalPrice: priceNum + shippingFeeNum,
      option,
      description,
      sourceLink,
      isSourceSoldOut: isSourceSoldOut === 'true',
      mainImage: mainImageKey,
      additionalImages: additionalImageKeys,

      // ✅ 저장: 새 구조 + 레거시 값(rate만)
      refundPolicy: policy,
      refundProbability: policy.rate,
    });

    const createdProduct = await product.save();

    // 박스 매핑 (기존 로직 유지)
    if (category) {
      const box = await Box.findOne({ name: category });
      if (box) {
        const exists = box.products.some(p => String(p.product) === String(createdProduct._id));
        if (!exists) {
          box.products.push({
            product: createdProduct._id,
            probability: parseFloat(probability) || 0,
          });
          await box.save();
        }
      }
    }

    const withUrls = await attachSignedUrls(createdProduct, 60 * 10);
    return res.status(200).json({ success: true, product: withUrls });
  } catch (err) {
    console.error('상품 등록 실패:', err);
    return res.status(500).json({ success: false, message: '상품 등록 중 오류가 발생했습니다.', error: err.message });
  }
};

// ─────────────────────────────────────────────────────
// 모든 제품 조회 (프리사인 URL 포함)
// ─────────────────────────────────────────────────────
exports.getAllProducts = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '토큰이 없습니다.' });
    jwt.verify(token, JWT_SECRET);

    const products = await Product.find().sort({ createdAt: -1 });

    if (!products || products.length === 0) {
      return res.status(200).json({ success: true, totalProducts: 0, products: [] });
    }

    // 많은 리스트에서 프리사인 남발이 부담되면 expiresIn을 짧게(예: 120s) 하거나,
    // 클라이언트가 필요할 때만 presign 받도록 엔드포인트 분리도 가능.
    const withUrls = await Promise.all(products.map(p => attachSignedUrls(p, 60 * 5)));

    res.status(200).json({
      success: true,
      totalProducts: products.length,
      products: withUrls,
    });
  } catch (err) {
    console.error('모든 제품 조회 실패:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// ─────────────────────────────────────────────────────
// 특정 제품 조회 (프리사인 URL 포함)
// ─────────────────────────────────────────────────────
exports.getProduct = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: '유효하지 않은 제품 ID입니다.' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
    jwt.verify(token, JWT_SECRET);

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });

    const withUrls = await attachSignedUrls(product, 60 * 10);

    return res.status(200).json({ success: true, product: withUrls });
  } catch (err) {
    console.error('제품 조회 중 오류:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// ─────────────────────────────────────────────────────
// 제품 삭제 (S3 객체도 함께 삭제)
// ─────────────────────────────────────────────────────
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });

  try {
    jwt.verify(token, JWT_SECRET);

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });

    // 1) S3 삭제 (실패해도 진행: best-effort)
    const tasks = [];
    if (typeof product.mainImage === 'string' && product.mainImage) {
      tasks.push(deleteS3Key(product.mainImage));
    }
    if (Array.isArray(product.additionalImages)) {
      for (const k of product.additionalImages) tasks.push(deleteS3Key(k));
    }
    await Promise.allSettled(tasks); // ✅ S3 실패가 DB/Box 삭제를 막지 않도록

    // 2) 모든 Box에서 해당 product 참조 제거
    const boxPull = await Box.updateMany(
      { 'products.product': id },
      { $pull: { products: { product: id } } }
    );

    // 3) 실제 Product 문서 삭제
    const del = await Product.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: '제품이 삭제되었습니다.',
      deletedProductId: id,
      boxUpdatedCount: boxPull?.modifiedCount || 0, // 몇 개 박스에서 빠졌는지 참고용
    });
  } catch (err) {
    console.error('제품 삭제 중 오류 발생:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// ─────────────────────────────────────────────────────
// 제품 수정 (S3 기반, 유지/교체/초기화 로직)
// ─────────────────────────────────────────────────────
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });

  try {
    jwt.verify(token, JWT_SECRET);

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다.' });

    // 🔸 대표 이미지 처리
    if (req.files?.mainImage?.length > 0) {
      const newKey = req.files.mainImage[0].key;
      if (product.mainImage && typeof product.mainImage === 'string') {
        await deleteS3Key(product.mainImage);
      }
      product.mainImage = newKey;
    } else if (req.body.retainMainImage === 'true') {
      // 유지
    } else if (req.body.retainMainImage === 'false') {
      if (product.mainImage && typeof product.mainImage === 'string') {
        await deleteS3Key(product.mainImage);
      }
      product.mainImage = '';
    }

    // 🔸 상세 이미지 처리
    if (req.files?.additionalImages?.length > 0) {
      const newKeys = req.files.additionalImages.map(f => f.key);

      const retained = req.body.initialAdditionalImages;
      const retainedArray = retained
        ? (Array.isArray(retained) ? retained : [retained])
        : [];

      // 유지 목록에 없는 기존 키는 삭제
      const toDelete = (product.additionalImages || []).filter(
        oldKey => !retainedArray.includes(String(oldKey))
      );
      await Promise.all(toDelete.map(k => deleteS3Key(k)));

      // 병합 저장
      product.additionalImages = [...retainedArray, ...newKeys];
    } else if (req.body.retainAdditionalImages === 'true') {
      const retained = req.body.initialAdditionalImages;
      product.additionalImages = retained
        ? (Array.isArray(retained) ? retained : [retained])
        : [];
    } else if (req.body.retainAdditionalImages === 'false') {
      await Promise.all((product.additionalImages || []).map(k => deleteS3Key(k)));
      product.additionalImages = [];
    }

    // 🔸 일반 텍스트/숫자 필드 (숫자는 캐스팅 권장)
    const fields = [
      'name', 'brand', 'category', 'probability',
      'consumerPrice', 'price', 'shippingFee',
      'option', 'description', 'sourceLink', 'refundProbability'
    ];
    fields.forEach((f) => {
      if (Object.prototype.hasOwnProperty.call(req.body, f)) {
        // 숫자형 필드는 Number 캐스팅
        if (['consumerPrice', 'price', 'shippingFee', 'probability', 'refundProbability'].includes(f)) {
          product[f] = Number(req.body[f]);
        } else {
          product[f] = req.body[f];
        }
      }
    });

    product.isSourceSoldOut = req.body.isSourceSoldOut === 'true';

    await product.save();

    // ── ✅ 카테고리(=박스 이름) 기준 박스 매핑 ─────────────────
    const targetBoxName = product.category && String(product.category).trim();
    if (targetBoxName) {
      const targetBox = await Box.findOne({ name: targetBoxName });

      if (targetBox) {
        // 1) 타겟 박스에 포함/업데이트
        const idx = targetBox.products.findIndex(p => String(p.product) === String(product._id));
        const probNum = Number(product.probability) || 0;

        if (idx >= 0) {
          // 이미 있으면 확률만 동기화
          targetBox.products[idx].probability = probNum;
        } else {
          // 없으면 추가
          targetBox.products.push({ product: product._id, probability: probNum });
        }
        await targetBox.save();

        // 2) 그 외 모든 박스에서 제거 (카테고리가 바뀐 경우 정리)
        await Box.updateMany(
          { _id: { $ne: targetBox._id }, 'products.product': product._id },
          { $pull: { products: { product: product._id } } }
        );
      } else {
        // 카테고리 이름에 해당하는 박스가 없으면, 기존 모든 박스에서 제거
        await Box.updateMany(
          { 'products.product': product._id },
          { $pull: { products: { product: product._id } } }
        );
      }
    } else {
      // 카테고리가 비어있다면, 모든 박스에서 제거
      await Box.updateMany(
        { 'products.product': product._id },
        { $pull: { products: { product: product._id } } }
      );
    }
    // ───────────────────────────────────────────────────

    // (선택) 확률 일괄 동기화 로직은 위에서 타겟 박스에만 반영하고
    // 나머지는 제거하므로 별도 updateMany로 전체 동기화할 필요가 없습니다.

    const withUrls = await attachSignedUrls(product, 60 * 10);
    return res.status(200).json({ success: true, product: withUrls });
  } catch (err) {
    console.error('제품 수정 중 오류 발생:', err);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};
// ─────────────────────────────────────────────────────
// 카테고리별 조회 (프리사인 URL 포함)
// ─────────────────────────────────────────────────────
exports.getProductsByCategory = async (req, res) => {
  const { category } = req.query;
  try {
    const products = await Product.find({ category }).sort({ createdAt: -1 });
    const withUrls = await Promise.all(products.map(p => attachSignedUrls(p, 60 * 5)));
    return res.status(200).json({
      success: true,
      totalProducts: withUrls.length,
      products: withUrls,
    });
  } catch (err) {
    console.error('카테고리로 제품 조회 중 오류 발생:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
};

// ─────────────────────────────────────────────────────
// 검색 (프리사인 URL은 성능상 제외. 필요하면 붙이세요.)
// ─────────────────────────────────────────────────────
exports.getProductsSearch = async (req, res) => {
  const { name, category } = req.query;

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: '로그인 정보가 없습니다.' });
    jwt.verify(token, JWT_SECRET);

    const query = {};
    if (name) query.name = { $regex: name, $options: 'i' };
    else if (category) query.category = { $regex: category, $options: 'i' };

    // 성능을 위해 기본 필드만
    const products = await Product.find(query).select('name _id probability category mainImage');

    // 검색결과에도 이미지가 꼭 보이게 하려면 아래 주석 해제:
    // const withUrls = await Promise.all(products.map(async p => {
    //   const obj = p.toObject();
    //   obj.mainImageUrl = obj.mainImage ? await presign(obj.mainImage, 60 * 3) : '';
    //   return obj;
    // }));

    res.json({ success: true, products /*: withUrls*/ });
  } catch (err) {
    res.status(500).json({ success: false, message: '검색 실패', error: err });
  }
};
