# Soft Store — Launch Checklist (Windows)

Work through these in order. ~30 minutes total. Zero cost.

---

## STEP 1 — Install Git (one time only)
- [ ] Go to https://git-scm.com/downloads
- [ ] Download "Windows" version → install with all default settings
- [ ] Restart your Command Prompt / PowerShell after installing

---

## STEP 2 — Set up Supabase (database) — 10 min
- [ ] Go to https://supabase.com → sign up with GitHub
- [ ] New project → name: soft-store, region: Southeast Asia (Singapore)
- [ ] Wait ~2 min for provisioning
- [ ] Click "SQL Editor" → "New query"
- [ ] Open soft-backend/schema.sql → copy all → paste → click Run
- [ ] Go to Settings → API → copy these 3 values (you'll need them in Step 4):
        SUPABASE_URL
        SUPABASE_ANON_KEY
        SUPABASE_SERVICE_ROLE_KEY
- Details: soft-backend/SUPABASE_SETUP.md

---

## STEP 3 — Push code to GitHub — 5 min

Option A — Double-click (easiest):
- [ ] Unzip soft_store_FINAL.zip somewhere on your PC
- [ ] Open Command Prompt → navigate to that folder
      e.g.  cd C:\Users\YourName\Downloads\AI_Projects
- [ ] Run:  git clone https://github.com/NarukaVaibhav/AI_Projects.git
- [ ] Run:  cd AI_Projects
- [ ] Copy the unzipped files into the AI_Projects folder
- [ ] Double-click push-to-github.bat
      OR right-click push-to-github.ps1 → "Run with PowerShell"

Option B — Manual commands:
      git add soft-frontend\ soft-backend\ README.md .gitignore
      git commit -m "Add Soft store"
      git push origin main

---

## STEP 4 — Deploy backend on Render — 10 min
- [ ] Go to https://render.com → sign up with Google
- [ ] New + → Web Service → connect GitHub → select AI_Projects
- [ ] Root Directory: soft-backend
- [ ] Build Command: npm install
- [ ] Start Command: npm start
- [ ] Instance Type: Free
- [ ] Add environment variables (see soft-backend/RENDER_SETUP.md for full list)
- [ ] Click "Create Web Service" → wait for green Live badge
- [ ] Test: open https://soft-backend.onrender.com/health in browser
- Details: soft-backend/RENDER_SETUP.md

---

## STEP 5 — Deploy frontend on Vercel — 5 min
- [ ] Go to https://vercel.com → sign up with GitHub
- [ ] Add New Project → select AI_Projects
- [ ] Root Directory: soft-frontend
- [ ] Framework: Other
- [ ] Click Deploy → live in 30 seconds
- [ ] Your store: https://soft-store.vercel.app
- Details: soft-frontend/VERCEL_SETUP.md

---

## STEP 6 — Connect frontend to backend
- [ ] Open soft-frontend/config.js
- [ ] Change API_BASE to your Render URL:
        window.SOFT_CONFIG = {
          API_BASE: 'https://soft-backend.onrender.com/api',
          ...
        }
- [ ] Save → git add . → git commit -m "update config" → git push
- [ ] Vercel auto-redeploys in 30 sec ✅

---

## STEP 7 — Test
- [ ] Visit your Vercel URL — homepage loads with products
- [ ] Click a product → add to bag → checkout → sign up
- [ ] Secret admin panel: click the Soft logo 5 times fast
- [ ] Check Supabase → Table Editor → orders → your test order appears

---

## Razorpay (do later when ready)
- Go to razorpay.com → sign up → get test keys
- Update RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Render env vars
- Test card: 4111 1111 1111 1111, any future date, CVV 123

Total cost to run: Rs 0 / month
