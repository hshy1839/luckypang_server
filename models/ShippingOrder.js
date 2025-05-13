    const mongoose = require('mongoose');

    const shippingOrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    shipping: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipping', required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }, 

    paymentType: {
        type: String,
        enum: ['point', 'card', 'mixed'],
        required: true
    },
    shippingFee: { type: Number, required: true }, // 실제 배송비
    pointUsed: { type: Number, default: 0 },
    paymentAmount: { type: Number, required: true }, // 실 결제 금액 (shippingFee - pointUsed)

    status: {
        type: String,
        enum: ['pending', 'paid', 'cancelled', 'shipped', 'refunded'],
        default: 'paid'
    },

    refunded: {
        point: { type: Number, default: 0 },
        cash: { type: Number, default: 0 }
    },

    createdAt: { type: Date, default: Date.now }
    });

    module.exports = mongoose.model('ShippingOrder', shippingOrderSchema);
