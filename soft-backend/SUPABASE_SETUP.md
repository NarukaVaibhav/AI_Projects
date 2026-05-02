# Supabase Setup — Step by Step

## 1. Create account
Go to **https://supabase.com** → Sign up with GitHub

## 2. Create project
- Click **"New project"**
- Name: `soft-store`
- Password: (save this somewhere safe)
- Region: **Southeast Asia (Singapore)** — closest to India
- Click **"Create new project"** → wait ~2 min

## 3. Run the schema
- Click **"SQL Editor"** in the left sidebar
- Click **"New query"**
- Open `soft-backend/schema.sql` from your project zip
- **Select all → Copy → Paste** into the SQL editor
- Click **"Run"**
- You should see: `Success. No rows returned`
- ✅ This creates all 8 tables + 9 products + 2 coupons

## 4. Collect your 3 keys
Go to **Settings → API** in your Supabase dashboard:

| Variable name | Where to find it |
|---|---|
| `SUPABASE_URL` | "Project URL" — looks like `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | "anon public" key — long string starting with `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role" key — another long `eyJ...` string |

⚠️ Keep the service_role key secret — never put it in frontend code.

## 5. Enable Google OAuth (optional — for Google sign in)
- Go to **Authentication → Providers → Google**
- Toggle **Enable**
- Go to [console.cloud.google.com](https://console.cloud.google.com)
- Create OAuth 2.0 credentials
- Add callback URL: `https://xxxx.supabase.co/auth/v1/callback`
- Paste Client ID + Secret into Supabase

## 6. Done! 
Paste all 3 keys into Render environment variables when deploying the backend.
