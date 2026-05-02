-- ═══════════════════════════════════════════════════════════════
-- Sōft Store — Supabase Database Schema
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE,
  phone         TEXT UNIQUE,
  first_name    TEXT NOT NULL DEFAULT '',
  last_name     TEXT NOT NULL DEFAULT '',
  password_hash TEXT,
  provider      TEXT DEFAULT 'email', -- 'email' | 'google' | 'phone'
  provider_id   TEXT,
  role          TEXT NOT NULL DEFAULT 'customer', -- 'customer' | 'admin'
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);

-- ─── PRODUCTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  description    TEXT,
  price          INTEGER NOT NULL,         -- in paise (₹1 = 100)? No: we store ₹ directly
  original_price INTEGER,
  category       TEXT NOT NULL CHECK (category IN ('tops','bottoms','outerwear','accessories')),
  gender         TEXT NOT NULL DEFAULT 'unisex' CHECK (gender IN ('unisex','women','men')),
  badge          TEXT CHECK (badge IN ('new','sale','bestseller')),
  colors         JSONB DEFAULT '[]',       -- ["#F5F2EE","#1A1816"]
  sizes          JSONB DEFAULT '[]',       -- ["XS","S","M","L","XL"]
  oos_sizes      JSONB DEFAULT '[]',       -- out-of-stock sizes
  stock          INTEGER NOT NULL DEFAULT 0,
  bg_color       TEXT DEFAULT '#E8E4DC',
  letter         TEXT DEFAULT 'S',
  sort_order     INTEGER DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_active ON products(is_active);

-- ─── ORDERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            TEXT UNIQUE NOT NULL,       -- e.g. SOFT-2026-10234
  user_id             UUID NOT NULL REFERENCES users(id),
  items               JSONB NOT NULL DEFAULT '[]',
  shipping_address    JSONB NOT NULL,
  subtotal            INTEGER NOT NULL,
  shipping_cost       INTEGER NOT NULL DEFAULT 0,
  discount            INTEGER NOT NULL DEFAULT 0,
  total               INTEGER NOT NULL,
  coupon_code         TEXT,
  status              TEXT NOT NULL DEFAULT 'pending_payment'
                      CHECK (status IN (
                        'pending_payment','confirmed','processing',
                        'shipped','delivered','cancelled',
                        'payment_failed','refunded'
                      )),
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,
  payment_method      TEXT,
  tracking_number     TEXT,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ─── WISHLISTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlists (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- ─── ADDRESSES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS addresses (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL DEFAULT 'Home',
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  address    TEXT NOT NULL,
  city       TEXT NOT NULL,
  state      TEXT NOT NULL,
  pin_code   TEXT NOT NULL,
  country    TEXT NOT NULL DEFAULT 'India',
  phone      TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── OTP TOKENS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_tokens (
  phone      TEXT PRIMARY KEY,
  otp_hash   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── COUPONS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code       TEXT UNIQUE NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value      INTEGER NOT NULL,        -- percent: 10 = 10%, fixed: 200 = ₹200
  min_order  INTEGER DEFAULT 0,
  max_uses   INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active  BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── NEWSLETTER ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── HELPER FUNCTION: Decrement stock safely ─────────────────
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock = GREATEST(0, stock - p_qty), updated_at = now()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- ─── ROW LEVEL SECURITY (RLS) ─────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own profile
CREATE POLICY "Users read own profile"   ON users FOR SELECT USING (auth.uid()::text = id::text);
CREATE POLICY "Users update own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);

-- Users can only see their own orders
CREATE POLICY "Users read own orders"    ON orders FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users create own orders"  ON orders FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Wishlists
CREATE POLICY "Users manage own wishlist" ON wishlists FOR ALL USING (auth.uid()::text = user_id::text);

-- Addresses
CREATE POLICY "Users manage own addresses" ON addresses FOR ALL USING (auth.uid()::text = user_id::text);

-- Products are public read
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products public read" ON products FOR SELECT USING (is_active = true);

-- ─── SEED: Sample coupons ─────────────────────────────────────
INSERT INTO coupons (code, type, value, is_active, expires_at) VALUES
  ('SOFT10',  'percent', 10,  true, '2027-12-31'),
  ('WELCOME', 'fixed',   200, true, '2027-12-31')
ON CONFLICT (code) DO NOTHING;

-- ─── SEED: Sample products ────────────────────────────────────
INSERT INTO products (name, description, price, original_price, category, gender, badge, colors, sizes, oos_sizes, stock, bg_color, letter, sort_order) VALUES
  ('Essential crew tee',     'The cornerstone of any wardrobe. 100% organic cotton, soft, breathable, relaxed fit.', 899,  NULL, 'tops',        'unisex', 'new',       '["#F5F2EE","#3D3A35","#C4BFB5","#1A1816"]', '["XS","S","M","L","XL","XXL","3XL"]', '["3XL"]', 48, '#E8E4DC', 'T', 1),
  ('Relaxed linen trousers', 'Wide-leg linen trousers with elasticated waistband. Gets softer with every wash.',      1899, 2299, 'bottoms',     'unisex', 'sale',      '["#E8E4DC","#3D3A35","#C4BFB5"]',           '["XS","S","M","L","XL","XXL"]',       '[]',     22, '#DDD9D1', 'P', 2),
  ('Soft cotton jacket',     'Minimal overshirt-style jacket in 100% brushed cotton. Unstructured and versatile.',   2499, NULL, 'outerwear',   'unisex', 'bestseller','["#1A1816","#E8E4DC","#888780"]',           '["S","M","L","XL","XXL"]',            '["XXL"]',15, '#E8E4DC', 'J', 3),
  ('Linen overshirt',        '100% European linen. Relaxed fit, two chest pockets, curved hem.',                     1599, NULL, 'tops',        'unisex', NULL,        '["#F5F2EE","#C4BFB5","#3D3A35"]',           '["XS","S","M","L","XL","XXL","3XL"]', '[]',     31, '#DDD9D1', 'O', 4),
  ('Wide-leg joggers',       'Heavyweight cotton-jersey joggers, wide relaxed leg. Deep side pockets.',               1299, 1599, 'bottoms',     'unisex', 'sale',      '["#3D3A35","#1A1816","#888780"]',           '["XS","S","M","L","XL","XXL"]',       '[]',     18, '#E8E4DC', 'J', 5),
  ('Ribbed cotton tank',     'Sleek ribbed tank in softest cotton blend. Close-fitting, slightly cropped.',           699,  NULL, 'tops',        'unisex', 'new',       '["#F5F2EE","#C4BFB5","#1A1816","#888780"]', '["XS","S","M","L","XL","XXL","3XL"]', '[]',     60, '#F5F2EE', 'K', 6),
  ('Drawstring shorts',      'Easy mid-length shorts. Elastic waist with drawstring, side and back pockets.',        999,  NULL, 'bottoms',     'unisex', NULL,        '["#E8E4DC","#3D3A35","#1A1816"]',           '["XS","S","M","L","XL","XXL"]',       '["XS"]', 27, '#DDD9D1', 'S', 7),
  ('Canvas tote bag',        'Sturdy canvas tote, 40×38cm. Printed with Sōft wordmark in tonal ink.',                499,  NULL, 'accessories', 'unisex', 'new',       '["#E8E4DC","#1A1816"]',                     '["One size"]',                        '[]',     80, '#E8E4DC', 'B', 8),
  ('Essential hoodie',       'Mid-weight pullover in French terry cotton. Kangaroo pocket, adjustable drawcord.',    2199, 2699, 'outerwear',   'unisex', 'sale',      '["#3D3A35","#1A1816","#E8E4DC","#888780"]', '["XS","S","M","L","XL","XXL","3XL"]', '[]',     34, '#DDD9D1', 'H', 9)
ON CONFLICT DO NOTHING;
