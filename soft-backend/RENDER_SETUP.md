# Render Setup — Backend Deployment

## 1. Create account
Go to **https://render.com** → "Get Started for Free" → Sign up with Google

## 2. New Web Service
- Click **"New +"** → **"Web Service"**
- Connect GitHub → Authorize Render
- Select repo: **NarukaVaibhav/AI_Projects**

## 3. Configure service
| Setting | Value |
|---|---|
| Name | `soft-backend` |
| Branch | `main` |
| Root Directory | `soft-backend` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | `Free` |

## 4. Add environment variables
Click **"Advanced"** → **"Add Environment Variable"** for each:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `SUPABASE_URL` | (from Supabase Settings → API) |
| `SUPABASE_ANON_KEY` | (from Supabase Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | (from Supabase Settings → API) |
| `JWT_SECRET` | Click "Generate" button in Render |
| `JWT_EXPIRES_IN` | `7d` |
| `RAZORPAY_KEY_ID` | `placeholder` (update later) |
| `RAZORPAY_KEY_SECRET` | `placeholder` (update later) |
| `RAZORPAY_WEBHOOK_SECRET` | `placeholder` (update later) |
| `FRONTEND_URL` | `https://soft-store.vercel.app` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX` | `100` |

## 5. Deploy
- Click **"Create Web Service"**
- Watch the build logs — takes 2-3 minutes
- Green **"Live"** badge = deployed ✅

## 6. Get your backend URL
Your API will be at: `https://soft-backend.onrender.com`

Test it: open `https://soft-backend.onrender.com/health` in browser
Should return: `{"status":"ok","service":"soft-backend"}`

## ⚠️ Free tier note
Free Render instances sleep after 15 min inactivity.
First request after sleep takes ~30 seconds. This is fine for testing.
Upgrade to Starter ($7/mo) when you want it always-on.
