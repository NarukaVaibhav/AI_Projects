const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');

// ─── GET /api/users/profile ───────────────────────────────────
router.get('/profile', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, created_at')
      .eq('id', req.user.id)
      .single();
    if (error) throw error;
    res.json({ user: data });
  } catch (err) { next(err); }
});

// ─── PATCH /api/users/profile ─────────────────────────────────
router.patch('/profile', authenticate,
  [
    body('first_name').optional().trim().notEmpty(),
    body('last_name').optional().trim(),
    body('phone').optional().isMobilePhone('en-IN'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const allowed = ['first_name', 'last_name', 'phone'];
      const updates = {};
      allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
      updates.updated_at = new Date();

      const { data, error } = await supabase
        .from('users').update(updates).eq('id', req.user.id).select().single();
      if (error) throw error;
      res.json({ message: 'Profile updated', user: data });
    } catch (err) { next(err); }
  }
);

// ─── GET /api/users/wishlist ──────────────────────────────────
router.get('/wishlist', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('wishlists')
      .select('product_id, products(*)')
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ wishlist: data.map(w => w.products) });
  } catch (err) { next(err); }
});

// ─── POST /api/users/wishlist/:productId ─────────────────────
router.post('/wishlist/:productId', authenticate, async (req, res, next) => {
  try {
    const { data: existing } = await supabase.from('wishlists')
      .select('id').eq('user_id', req.user.id).eq('product_id', req.params.productId).single();

    if (existing) {
      await supabase.from('wishlists').delete().eq('id', existing.id);
      return res.json({ message: 'Removed from wishlist', wishlisted: false });
    }

    await supabase.from('wishlists').insert({ user_id: req.user.id, product_id: req.params.productId });
    res.json({ message: 'Added to wishlist', wishlisted: true });
  } catch (err) { next(err); }
});

// ─── GET /api/users/addresses ────────────────────────────────
router.get('/addresses', authenticate, async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('addresses')
      .select('*').eq('user_id', req.user.id).order('is_default', { ascending: false });
    if (error) throw error;
    res.json({ addresses: data });
  } catch (err) { next(err); }
});

// ─── POST /api/users/addresses ────────────────────────────────
router.post('/addresses', authenticate,
  [
    body('label').trim().notEmpty(),
    body('address').trim().notEmpty(),
    body('city').trim().notEmpty(),
    body('state').trim().notEmpty(),
    body('pin_code').matches(/^\d{6}$/),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      if (req.body.is_default) {
        await supabase.from('addresses').update({ is_default: false }).eq('user_id', req.user.id);
      }

      const { data, error } = await supabase.from('addresses')
        .insert({ ...req.body, user_id: req.user.id }).select().single();
      if (error) throw error;
      res.status(201).json({ message: 'Address saved', address: data });
    } catch (err) { next(err); }
  }
);

module.exports = router;
