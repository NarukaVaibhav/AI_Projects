const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─── POST /api/payments/create-order ─────────────────────────
// Creates a Razorpay order for the given Sōft order
router.post('/create-order',
  authenticate,
  [body('order_id').notEmpty().withMessage('order_id required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { order_id } = req.body;

      // Fetch the Sōft order
      const { data: softOrder, error } = await supabase
        .from('orders')
        .select('id, order_id, total, status')
        .eq('id', order_id)
        .eq('user_id', req.user.id)
        .single();

      if (error || !softOrder) return res.status(404).json({ error: 'Order not found' });
      if (softOrder.status !== 'pending_payment') {
        return res.status(400).json({ error: 'Order already paid or cancelled' });
      }

      // Create Razorpay order (amount in paise)
      const rpOrder = await razorpay.orders.create({
        amount: Math.round(softOrder.total * 100),
        currency: 'INR',
        receipt: softOrder.order_id,
        notes: {
          soft_order_id: softOrder.id,
          soft_order_ref: softOrder.order_id,
        },
      });

      // Store Razorpay order ID
      await supabase
        .from('orders')
        .update({ razorpay_order_id: rpOrder.id })
        .eq('id', order_id);

      res.json({
        razorpay_order_id: rpOrder.id,
        amount: rpOrder.amount,
        currency: rpOrder.currency,
        key_id: process.env.RAZORPAY_KEY_ID,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/payments/verify ────────────────────────────────
// Verifies payment signature after Razorpay checkout
router.post('/verify',
  authenticate,
  [
    body('razorpay_order_id').notEmpty(),
    body('razorpay_payment_id').notEmpty(),
    body('razorpay_signature').notEmpty(),
    body('soft_order_id').notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        soft_order_id,
      } = req.body;

      // Verify HMAC signature
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'Payment signature verification failed' });
      }

      // Get payment details from Razorpay
      const payment = await razorpay.payments.fetch(razorpay_payment_id);

      // Update order status
      const { data: order, error } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          razorpay_payment_id,
          razorpay_signature,
          payment_method: payment.method,
          paid_at: new Date(),
          updated_at: new Date(),
        })
        .eq('id', soft_order_id)
        .eq('user_id', req.user.id)
        .select('order_id, total, status')
        .single();

      if (error) throw error;

      // Deduct stock for each item
      const { data: fullOrder } = await supabase
        .from('orders')
        .select('items')
        .eq('id', soft_order_id)
        .single();

      if (fullOrder?.items) {
        for (const item of fullOrder.items) {
          await supabase.rpc('decrement_stock', {
            p_product_id: item.product_id,
            p_qty: item.quantity,
          });
        }
      }

      res.json({
        message: 'Payment verified successfully',
        order: {
          order_id: order.order_id,
          total: order.total,
          status: order.status,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/payments/webhook ───────────────────────────────
// Razorpay webhook (raw body required — configured in server.js)
router.post('/webhook', async (req, res, next) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = JSON.parse(body.toString());
    const { event: eventType, payload } = event;

    switch (eventType) {
      case 'payment.captured': {
        const paymentId = payload.payment.entity.id;
        const receipt = payload.payment.entity.order_id;
        await supabase
          .from('orders')
          .update({ status: 'confirmed', razorpay_payment_id: paymentId, paid_at: new Date() })
          .eq('razorpay_order_id', receipt);
        break;
      }
      case 'payment.failed': {
        const receipt = payload.payment.entity.order_id;
        await supabase
          .from('orders')
          .update({ status: 'payment_failed', updated_at: new Date() })
          .eq('razorpay_order_id', receipt);
        break;
      }
      case 'refund.created': {
        const orderId = payload.refund.entity.order_id;
        await supabase
          .from('orders')
          .update({ status: 'refunded', updated_at: new Date() })
          .eq('razorpay_order_id', orderId);
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
