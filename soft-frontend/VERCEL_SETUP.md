# Vercel Setup — Frontend Deployment

## 1. Create account
Go to **https://vercel.com** → "Sign Up" → "Continue with GitHub"

## 2. Import project
- Click **"Add New Project"**
- Select repo: **NarukaVaibhav/AI_Projects**
- Click **"Import"**

## 3. Configure
| Setting | Value |
|---|---|
| Project Name | `soft-store` |
| Framework Preset | `Other` |
| Root Directory | `soft-frontend` |
| Build Command | *(leave empty)* |
| Output Directory | *(leave empty)* |

## 4. Deploy
- Click **"Deploy"**
- Wait ~30 seconds
- Your store is live at: **https://soft-store.vercel.app** ✅

## 5. Connect to your backend
After Render is deployed, update `soft-frontend/config.js`:

```js
window.SOFT_CONFIG = {
  API_BASE: 'https://soft-backend.onrender.com/api',  // ← your Render URL
  RAZORPAY_KEY: '',
  RAZORPAY_ENABLED: false,
};
```

Commit and push → Vercel auto-redeploys in 30 seconds.

## 6. Auto-deploys
Every time you push to GitHub `main` branch, Vercel automatically redeploys.
No manual steps needed after the first setup.

## Custom domain (when ready)
- Vercel dashboard → your project → Settings → Domains
- Add your domain (e.g. soft.in)
- Follow DNS instructions (takes ~10 min)
