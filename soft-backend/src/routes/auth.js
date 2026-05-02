const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { supabase, supabasePublic } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');

// Helper: generate signed JWT
const signToken = (userId, email, role) =>
  jwt.sign({ userId, email, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ─── POST /api/auth/register ──────────────────────────────────
router.post('/register',
  [
    body('first_name').trim().notEmpty().withMessage('First name required'),
    body('last_name').trim().notEmpty().withMessage('Last name required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/(?=.*[a-zA-Z])(?=.*\d)/).withMessage('Password must contain letters and numbers'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { first_name, last_name, email, password, phone } = req.body;

      // Check if email already exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const { data: user, error } = await supabase
        .from('users')
        .insert({
          id: uuidv4(),
          first_name,
          last_name,
          email,
          password_hash: passwordHash,
          phone: phone || null,
          role: 'customer',
          is_active: true,
        })
        .select('id, email, first_name, last_name, role')
        .single();

      if (error) throw error;

      const token = signToken(user.id, user.email, user.role);

      res.status(201).json({
        message: 'Account created successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          role: user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/login ─────────────────────────────────────
router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid email or password' });
      }

      const { email, password } = req.body;

      const { data: user } = await supabase
        .from('users')
        .select('id, email, password_hash, first_name, last_name, role, is_active')
        .eq('email', email)
        .single();

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      if (!user.is_active) {
        return res.status(403).json({ error: 'Account suspended. Contact support.' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Update last login
      await supabase.from('users').update({ last_login: new Date() }).eq('id', user.id);

      const token = signToken(user.id, user.email, user.role);

      res.json({
        message: 'Signed in successfully',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          role: user.role,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/google ────────────────────────────────────
// Frontend sends Google access_token; backend verifies via Supabase OAuth
router.post('/google', async (req, res, next) => {
  try {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ error: 'access_token required' });

    // Verify with Google
    const googleRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${access_token}`
    );
    const googleUser = await googleRes.json();

    if (!googleRes.ok || !googleUser.email) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    // Upsert user
    let { data: user } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, is_active')
      .eq('email', googleUser.email)
      .single();

    if (!user) {
      const nameParts = (googleUser.name || '').split(' ');
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          id: uuidv4(),
          email: googleUser.email,
          first_name: nameParts[0] || 'Google',
          last_name: nameParts.slice(1).join(' ') || 'User',
          provider: 'google',
          provider_id: googleUser.sub,
          role: 'customer',
          is_active: true,
        })
        .select('id, email, first_name, last_name, role')
        .single();
      if (error) throw error;
      user = newUser;
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    const token = signToken(user.id, user.email, user.role);
    res.json({
      message: 'Signed in with Google',
      token,
      user: { id: user.id, email: user.email, name: `${user.first_name} ${user.last_name}`, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/auth/send-otp ──────────────────────────────────
router.post('/send-otp',
  [body('phone').isMobilePhone('en-IN').withMessage('Valid Indian mobile number required')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { phone } = req.body;
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      // Store OTP in DB (in production, also send via SMS gateway e.g. MSG91, Twilio)
      await supabase.from('otp_tokens').upsert({
        phone,
        otp_hash: await bcrypt.hash(otp, 8),
        expires_at: expiresAt,
      }, { onConflict: 'phone' });

      // TODO: Integrate SMS provider here
      // await sendSMS(phone, `Your Sōft OTP is: ${otp}. Valid for 10 minutes.`);

      console.log(`[DEV] OTP for ${phone}: ${otp}`); // Remove in production

      res.json({ message: 'OTP sent successfully', phone });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/auth/verify-otp ────────────────────────────────
router.post('/verify-otp',
  [
    body('phone').isMobilePhone('en-IN'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { phone, otp } = req.body;

      const { data: record } = await supabase
        .from('otp_tokens')
        .select('otp_hash, expires_at')
        .eq('phone', phone)
        .single();

      if (!record) return res.status(400).json({ error: 'OTP not found. Please request a new one.' });
      if (new Date() > new Date(record.expires_at)) {
        return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
      }

      const valid = await bcrypt.compare(otp, record.otp_hash);
      if (!valid) return res.status(400).json({ error: 'Invalid OTP' });

      // Delete used OTP
      await supabase.from('otp_tokens').delete().eq('phone', phone);

      // Upsert user
      let { data: user } = await supabase
        .from('users')
        .select('id, phone, first_name, last_name, role, is_active')
        .eq('phone', phone)
        .single();

      if (!user) {
        const { data: newUser } = await supabase
          .from('users')
          .insert({
            id: uuidv4(),
            phone,
            first_name: 'User',
            last_name: '',
            provider: 'phone',
            role: 'customer',
            is_active: true,
          })
          .select('id, phone, first_name, role')
          .single();
        user = newUser;
      }

      const token = signToken(user.id, user.phone, user.role);
      res.json({
        message: 'Verified successfully',
        token,
        user: { id: user.id, phone: user.phone, role: user.role },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const { data: user } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, phone, role, created_at')
    .eq('id', req.user.id)
    .single();
  res.json({ user });
});

// ─── POST /api/auth/logout ────────────────────────────────────
router.post('/logout', authenticate, (req, res) => {
  // JWT is stateless — instruct frontend to clear token
  // For token blacklisting, add to a Redis cache or DB table
  res.json({ message: 'Signed out successfully' });
});

module.exports = router;
