// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const {
  createProduct, getAllProducts, deleteProduct,
  getProduct, updateProduct, getProductsByCategory, getProductsSearch
} = require('../controllers/productController');

const { upload } = require('../middlewares/upload'); // ← multer-s3 미들웨어

router.post(
  '/products/productCreate',
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImages', maxCount: 20 },
  ]),
  createProduct
);

router.put(
  '/products/update/:id',
  upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImages', maxCount: 20 },
  ]),
  updateProduct
);

router.get('/products/allProduct', getAllProducts);
router.get('/products/search', getProductsSearch);
router.get('/products/Product/:id', getProduct);
router.get('/products/allProduct/category', getProductsByCategory);
router.delete('/products/delete/:id', deleteProduct);

module.exports = router;
