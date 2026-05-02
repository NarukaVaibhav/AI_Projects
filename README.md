# Sōft — Clothing Brand Web App

A full-stack e-commerce web application for the Sōft clothing brand.

## Structure

```
/
├── soft-frontend/      # Static HTML/CSS/JS frontend → deploy to Vercel
│   ├── index.html      # Full single-page app
│   └── vercel.json     # Vercel deployment config
│
└── soft-backend/       # Node.js + Express REST API → deploy to Render
    ├── src/
    │   ├── server.js           # Entry point
    │   ├── config/supabase.js  # DB connection
    │   ├── middleware/auth.js  # JWT middleware
    │   └── routes/             # auth, products, orders, payments, users, admin
    ├── schema.sql              # Run this in Supabase SQL editor
    ├── render.yaml             # Render deployment config
    ├── .env.example            # Copy to .env and fill in secrets
    └── package.json
```

## Quick start

See `SOFT_DEPLOYMENT_GUIDE.docx` for the complete step-by-step guide.

## Tech stack

- **Frontend**: Vanilla HTML/CSS/JS · Vercel
- **Backend**: Node.js · Express · JWT auth · Helmet · Rate limiting
- **Database**: PostgreSQL via Supabase (with RLS)
- **Auth**: Email + Google OAuth + Phone OTP
- **Payments**: Razorpay (UPI, cards, wallets, COD)
- **Security**: CORS whitelist · bcryptjs · express-validator · Helmet.js

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in all values before running locally.
Never commit `.env` to GitHub.
