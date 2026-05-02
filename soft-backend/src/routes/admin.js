const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin);

// ─── GET /api/admin/dashboard ─────────────────────────────────
router.get('/dashboard', async (req, res, next) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [ordersThisMonth, ordersLastMonth, totalCustomers, lowStock] = await Promise.all([
      supabase.from('orders').select('total, status').gte('created_at', monthStart.toISOString())
        .in('status', ['confirmed', 'processing', 'shipped', 'delivered']),
      supabase.from('orders').select('total').gte('created_at', lastMonthStart.toISOString())
        .lt('created_at', monthStart.toISOString()).in('status', ['confirmed', 'processing', 'shipped', 'delivered']),
      supabase.from('users').select('id', { count: 'exact' }).eq('role', 'customer'),
      supabase.from('products').select('id, name, stock').lt('stock', 5).eq('is_active', true),
    ]);

    const thisRevenue = (ordersThisMonth.data || []).reduce((s, o) => s + o.total, 0);
    const lastRevenue = (ordersLastMonth.data || []).reduce((s, o) => s + o.total, 0);
    const revenueChange = lastRevenue ? Math.round(((thisRevenue - lastRevenue) / lastRevenue) * 100) : 0;

    const recentOrders = await supabase
      .from('orders')
      .select('order_id, total, status, created_at, users(first_name, last_name, email)')
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      stats: {
        revenue: { value: thisRevenue, change: revenueChange },
        orders: { value: (ordersThisMonth.data || []).length },
        customers: { value: totalCustomers.count || 0 },
        avg_order_value: {
          value: (ordersThisMonth.data || []).length
            ? Math.round(thisRevenue / (ordersThisMonth.data || []).length)
            : 0,
        },
      },
      recent_orders: recentOrders.data || [],
      low_stock_alerts: lowStock.data || [],
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/analytics ─────────────────────────────────
router.get('/analytics', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { data: orders } = await supabase
      .from('orders')
      .select('total, created_at, items')
      .gte('created_at', from.toISOString())
      .in('status', ['confirmed', 'processing', 'shipped', 'delivered']);

    // Revenue by day
    const revenueByDay = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      revenueByDay[d.toISOString().split('T')[0]] = 0;
    }
    (orders || []).forEach(o => {
      const day = new Date(o.created_at).toISOString().split('T')[0];
      if (revenueByDay[day] !== undefined) revenueByDay[day] += o.total;
    });

    // Top products
    const productSales = {};
    (orders || []).forEach(o => {
      (o.items || []).forEach(item => {
        if (!productSales[item.product_name]) productSales[item.product_name] = 0;
        productSales[item.product_name] += item.quantity;
      });
    });
    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    res.json({
      revenue_by_day: Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue })),
      top_products: topProducts,
      total_revenue: (orders || []).reduce((s, o) => s + o.total, 0),
      total_orders: (orders || []).length,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/customers ─────────────────────────────────
router.get('/customers', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const from = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, created_at, role', { count: 'exact' })
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (error) throw error;
    res.json({ customers: data, total: count, page });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/orders ────────────────────────────────────
router.get('/orders', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const from = (page - 1) * limit;

    let q = supabase
      .from('orders')
      .select('*, users(first_name, last_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (req.query.status) q = q.eq('status', req.query.status);

    const { data, error, count } = await q;
    if (error) throw error;
    res.json({ orders: data, total: count, page });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
