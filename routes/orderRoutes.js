// routes/orders.js
const express = require('express');
const router = express.Router();
const orderCtrl = require('../controllers/orderController');

router.post('/order', orderCtrl.addToOrder);
router.get('/orders', orderCtrl.getOrdersByUserId); // ?userId=&paged=true&page=&limit=
router.get('/orders/boxes', orderCtrl.getBoxesPaged); // ?userId=&status=paid&unboxed=false&page=&limit=
router.get('/orders/unboxed-products', orderCtrl.getUnboxedProductsPaged); // ?userId=&status=unshipped|shipped&refunded=false&page=&limit=
router.get('/orders/unboxed', orderCtrl.getUnboxedOrdersByUserId);
router.get('/orders/all', orderCtrl.getAllOrders);
router.get('/order/:id', orderCtrl.getOrderById);

router.post('/orders/:id/unbox', orderCtrl.unboxOrder);
router.post('/orders/unbox/batch', orderCtrl.unboxOrdersBatch);

router.post('/orders/:id/refund', orderCtrl.refundOrder);
router.patch('/order/:id', orderCtrl.updateOrder);
router.patch('/orders/:id/tracking', orderCtrl.updateTrackingNumber);

module.exports = router;
