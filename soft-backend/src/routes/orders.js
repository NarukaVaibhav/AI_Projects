const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ─── POST /api/orders ─────────────────────────────────────────
router.post('/',
  authenticate,
  [
    body('items').isArray({ min: 1 }).withMessage('Cart cannot be empty'),
    body('items.*.product_id').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.size').notEmpty(),
    body('shipping_address').isObject(),
    body('shipping_address.first_name').notEmpty(),
    body('shipping_address.last_name').notEmpty(),
    body('shipping_address.address').notEmpty(),
    body('shipping_address.city').notEmpty(),
    body('shipping_address.state').notEmpty(),
    body('shipping_address.pin_code').matches(/^\d{6}$/),
    body('shipping_address.phone').notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { items, shipping_address, coupon_code } = req.body;

      // Validate products and calculate totals
      const productIds = items.map(i => i.product_id);
      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id, name, price, stock, is_active')
        .in('id', productIds);

      if (prodErr) throw prodErr;

      let subtotal = 0;
      const validatedItems = [];

      for (const item of items) {
        const product = products.find(p => p.id === item.product_id);
        if (!product || !product.is_active) {
          return res.status(400).json({ error: `Product ${item.product_id} not available` });
        }
        if (product.stock < item.quantity) {
          return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
        }
        const lineTotal = product.price * item.quantity;
        subtotal += lineTotal;
        validatedItems.push({
          product_id: item.product_id,
          product_name: product.name,
          size: item.size,
          color: item.color || null,
          quantity: item.quantity,
          unit_price: product.price,
          line_total: lineTotal,
        });
      }

      // Coupon validation
      let discount = 0;
      if (coupon_code) {
        const { data: coupon } = await supabase
          .from('coupons')
          .select('*')
          .eq('code', coupon_code.toUpperCase())
          .eq('is_active', true)
          .single();

        if (coupon && new Date() <= new Date(coupon.expires_at)) {
          if (coupon.type === 'percent') discount = Math.round(subtotal * coupon.value / 100);
          if (coupon.type === 'fixed') discount = coupon.value;
          discount = Math.min(discount, subtotal);
        }
      }

      const shipping = subtotal >= 999 ? 0 : 79;
      const total = subtotal + shipping - discount;

      const orderId = `SOFT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 90000) + 10000)}`;

      // Create order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          id: uuidv4(),
          order_id: orderId,
          user_id: req.user.id,
          items: validatedItems,
          shipping_address,
          subtotal,
          shipping_cost: shipping,
          discount,
          total,
          coupon_code: coupon_code || null,
          status: 'pending_payment',
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      res.status(201).json({
        message: 'Order created',
        order: {
          id: order.id,
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

// ─── GET /api/orders (user's orders) ─────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_id, total, status, created_at, items')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ orders: data });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/orders/:id ──────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: data });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/orders/:id/status (Admin) ────────────────────
router.patch('/:id/status', authenticate, requireAdmin,
  [body('status').isIn(['pending_payment', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { data, error } = await supabase
        .from('orders')
        .update({ status: req.body.status, tracking_number: req.body.tracking_number || null, updated_at: new Date() })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;
      res.json({ message: 'Order status updated', order: data });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
