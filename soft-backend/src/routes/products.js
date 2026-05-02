const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');

// ─── GET /api/products ────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    let dbQuery = supabase.from('products').select('*').eq('is_active', true);

    if (req.query.category) dbQuery = dbQuery.eq('category', req.query.category);
    if (req.query.gender) dbQuery = dbQuery.eq('gender', req.query.gender);
    if (req.query.min_price) dbQuery = dbQuery.gte('price', parseInt(req.query.min_price));
    if (req.query.max_price) dbQuery = dbQuery.lte('price', parseInt(req.query.max_price));
    if (req.query.badge) dbQuery = dbQuery.eq('badge', req.query.badge);
    if (req.query.search) dbQuery = dbQuery.ilike('name', `%${req.query.search}%`);

    const sortMap = {
      'price-asc': { column: 'price', ascending: true },
      'price-desc': { column: 'price', ascending: false },
      'newest': { column: 'created_at', ascending: false },
      'featured': { column: 'sort_order', ascending: true },
    };
    const sort = sortMap[req.query.sort] || sortMap['featured'];
    dbQuery = dbQuery.order(sort.column, { ascending: sort.ascending });

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const from = (page - 1) * limit;
    dbQuery = dbQuery.range(from, from + limit - 1);

    const { data, error, count } = await dbQuery;
    if (error) throw error;

    res.json({ products: data, total: count, page, limit });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/products/:id ────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .eq('is_active', true)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: data });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/products (Admin) ───────────────────────────────
router.post('/', authenticate, requireAdmin,
  [
    body('name').trim().notEmpty(),
    body('price').isInt({ min: 1 }),
    body('category').isIn(['tops', 'bottoms', 'outerwear', 'accessories']),
    body('stock').isInt({ min: 0 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { data, error } = await supabase
        .from('products')
        .insert({ ...req.body, is_active: true })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json({ message: 'Product created', product: data });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /api/products/:id (Admin) ─────────────────────────
router.patch('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const allowed = ['name', 'description', 'price', 'original_price', 'stock',
      'category', 'gender', 'badge', 'colors', 'sizes', 'oos_sizes', 'is_active'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    updates.updated_at = new Date();

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: 'Product updated', product: data });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/products/:id (Admin — soft delete) ──────────
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await supabase.from('products').update({ is_active: false }).eq('id', req.params.id);
    res.json({ message: 'Product deactivated' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
