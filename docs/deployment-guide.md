# Deployment Guide - Hosting & Infrastructure

This guide walks you through deploying the Wild Bean Coffee application to production.

## Overview

Your application consists of:
- **Frontend**: Next.js 16 application (in `client/`)
- **Backend**: Express.js API server (in `server/`)
- **Database**: MongoDB Atlas (already configured)

## Platform Recommendations

### Option 1: Vercel (Frontend) + Railway/Render (Backend) - **Recommended**
- **Frontend**: Vercel (optimized for Next.js, free tier available)
- **Backend**: Railway or Render (easy Node.js deployment, free tier available)
- **Pros**: Easy setup, great Next.js integration, automatic HTTPS
- **Cons**: Two separate platforms to manage

### Option 2: Vercel (Full Stack)
- **Frontend**: Vercel
- **Backend**: Vercel Serverless Functions (requires refactoring)
- **Pros**: Single platform, excellent Next.js support
- **Cons**: Requires converting Express routes to serverless functions

### Option 3: Render (Full Stack)
- **Frontend**: Render Static Site
- **Backend**: Render Web Service
- **Pros**: Single platform, simple deployment
- **Cons**: Less optimized for Next.js than Vercel

### Option 4: AWS/GCP/Azure
- **Pros**: Enterprise-grade, highly scalable
- **Cons**: More complex setup, higher cost

**We'll use Option 1 (Vercel + Railway) for this guide.**

---

## Step 1: Prepare for Deployment

### 1.1 Create Production Environment Files

Create `.env.production` files (don't commit these to git):

**`server/.env.production`**:
```bash
PORT=4000
MONGODB_URI=your_production_mongodb_uri
MONGO_MAX_RETRIES=5
MONGO_RETRY_DELAY_MS=1000
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com
CLOVER_API_KEY=
CLOVER_MERCHANT_ID=
CLOVER_WEBHOOK_SECRET=
NODE_ENV=production
```

**`client/.env.production`**:
```bash
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
```

### 1.2 Update .gitignore

Ensure both `.env.production` files are in `.gitignore`:
```
# .gitignore
.env.production
.env.local
.env*.local
```

### 1.3 Verify Build Scripts

Your `package.json` files already have the correct scripts:
- **Client**: `build` and `start` scripts are present ✅
- **Server**: `start` script is present ✅

### 1.4 Bump App Version (production releases)

Before each production deploy, bump semver from the **repo root**:

```bash
npm run release:patch   # 0.1.0 → 0.1.1 (typical)
npm run release:minor
npm run release:major
```

Commit the updated `version.json` and package files, tag (`git tag v0.1.1`), and push. The version appears in the site footer and on `GET /health`. See [deployment-checklist.md](./deployment-checklist.md) for the full release checklist.

---

## Step 2: Deploy Backend (Railway)

### 2.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Create a new project

### 2.2 Deploy Backend Service
1. Click "New Project" → "Deploy from GitHub repo"
2. Select your repository
3. Choose the `server` directory as the root
4. Railway will auto-detect Node.js

### 2.3 Configure Environment Variables
In Railway dashboard → Your service → Variables tab, add:

```
PORT=4000
MONGODB_URI=your_production_mongodb_atlas_uri
MONGO_MAX_RETRIES=5
MONGO_RETRY_DELAY_MS=1000
CORS_ORIGIN=https://your-frontend-domain.vercel.app
NODE_ENV=production
```

**Important**: 
- Use your **production** MongoDB Atlas URI (not test database)
- Update `CORS_ORIGIN` with your actual frontend URL after deploying

### 2.4 Configure Build Settings
Railway should auto-detect, but verify:
- **Root Directory**: `server`
- **Build Command**: (none needed, Railway installs dependencies automatically)
- **Start Command**: `npm start`

### 2.5 Get Backend URL
After deployment, Railway provides a URL like:
```
https://wild-bean-coffee-server-production.up.railway.app
```

**Save this URL** - you'll need it for the frontend configuration.

### 2.6 Test Backend Deployment
1. Visit `https://your-backend-url.railway.app/health`
2. Should return: `{"status":"ok","db":{"status":"connected"}}`

---

## Step 3: Deploy Frontend (Vercel)

### 3.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Import your repository

### 3.2 Configure Project
1. **Framework Preset**: Next.js (auto-detected)
2. **Root Directory**: `client`
3. **Build Command**: `npm run build` (default)
4. **Output Directory**: `.next` (default)

### 3.3 Configure Environment Variables
In Vercel dashboard → Your project → Settings → Environment Variables, add:

```
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
```

**Important**: Replace with your actual Railway backend URL from Step 2.5

### 3.4 Deploy
1. Click "Deploy"
2. Vercel will build and deploy your Next.js app
3. You'll get a URL like: `https://wild-bean-coffee.vercel.app`

### 3.5 Update Backend CORS
Go back to Railway and update the `CORS_ORIGIN` variable:
```
CORS_ORIGIN=https://wild-bean-coffee.vercel.app,https://www.wild-bean-coffee.vercel.app
```

Railway will automatically restart the service.

---

## Step 4: Configure MongoDB Atlas

### 4.1 Network Access
1. Go to MongoDB Atlas → Network Access
2. Add IP Address: `0.0.0.0/0` (allow all - Railway uses dynamic IPs)
   - Or add Railway's specific IP ranges if available

### 4.2 Database User
Ensure your database user has read/write permissions for your production database.

### 4.3 Verify Connection
Your backend should connect automatically. Check Railway logs to confirm.

---

## Step 5: Seed Production Database (Optional)

If you want to seed your production database:

1. **Option A: Use Railway CLI**
   ```bash
   railway login
   railway link
   railway run npm run seed
   ```

2. **Option B: Temporary Script**
   - Temporarily add seed script to Railway
   - Run it once
   - Remove the script

**⚠️ Warning**: Only seed production if you want sample data. Your production database should start empty or with real data.

---

## Step 6: Test Your Deployment

### 6.1 Test Frontend
1. Visit your Vercel URL
2. Check that pages load correctly
3. Test navigation

### 6.2 Test API Connection
1. Open browser DevTools → Network tab
2. Navigate to Shop or Menu page
3. Verify API calls are going to your Railway backend
4. Check for CORS errors in console

### 6.3 Test Critical Flows
- Browse products ✅
- Browse menu ✅
- Add items to cart ✅
- View location ✅
- Submit order ✅

### 6.4 Check Backend Logs
- Railway dashboard → Your service → Logs
- Look for any errors or warnings

---

## Step 7: Custom Domain Setup

### 7.1 Purchase Domain (If Needed)
If you don't own `wildBeanCoffee.com` yet:
- Purchase from: Namecheap, Google Domains, GoDaddy, Cloudflare, etc.
- Typical cost: $10-15/year

### 7.2 Add Domain to Vercel
1. Go to Vercel dashboard → Your project → **Settings** → **Domains**
2. Click **Add Domain**
3. Enter your domain: `www.wildBeanCoffee.com`
4. Vercel will show you DNS configuration instructions

### 7.3 Configure DNS Records
You need to add DNS records in your domain registrar:

**Option A: CNAME Record (Recommended for www)**
- **Type**: CNAME
- **Name**: `www`
- **Value**: `cname.vercel-dns.com`
- **TTL**: 3600 (or default)

**Option B: A Record (For root domain)**
If you also want `wildBeanCoffee.com` (without www):
- **Type**: A
- **Name**: `@` (or blank)
- **Value**: `76.76.21.21` (Vercel's IP - check Vercel dashboard for current IP)
- **TTL**: 3600

**Note**: Vercel provides the exact DNS values in their dashboard - use those!

### 7.4 Wait for DNS Propagation
- DNS changes can take 5 minutes to 48 hours
- Usually takes 10-30 minutes
- Check status in Vercel dashboard

### 7.5 SSL Certificate
- Vercel automatically provisions SSL certificates (HTTPS)
- Usually takes a few minutes after DNS is verified
- You'll see a green checkmark when ready

### 7.6 Update Environment Variables

**In Vercel:**
- No changes needed - `NEXT_PUBLIC_API_URL` stays the same (points to Railway backend)

**In Railway (Backend):**
Update `CORS_ORIGIN` to include your custom domain:
```
CORS_ORIGIN=https://www.wildBeanCoffee.com,https://wildBeanCoffee.com
```

**Important**: 
- Include both `www` and non-`www` versions
- Use `https://` (Vercel provides SSL automatically)
- Railway will auto-restart after updating

### 7.7 Verify Domain
1. Visit `https://www.wildBeanCoffee.com`
2. Should load your Vercel-deployed site
3. Check browser shows secure padlock (SSL working)
4. Test API calls work (check browser DevTools)

### 7.8 Redirect Root Domain (Optional)
If you want `wildBeanCoffee.com` to redirect to `www.wildBeanCoffee.com`:
1. Add `wildBeanCoffee.com` as a domain in Vercel
2. Vercel will automatically redirect to www version
3. Or configure redirect in your domain registrar

---

## Step 8: Production Checklist

- [ ] Backend deployed and accessible
- [ ] Frontend deployed and accessible
- [ ] Environment variables configured
- [ ] MongoDB Atlas network access configured
- [ ] CORS configured correctly
- [ ] API endpoints responding
- [ ] Frontend can communicate with backend
- [ ] No console errors in browser
- [ ] All critical user flows working
- [ ] Database seeded (if needed)
- [ ] Custom domain configured (if using)
- [ ] SSL/HTTPS working (automatic with Vercel/Railway)

---

## Troubleshooting

### Backend Issues

**Problem**: Backend not starting
- Check Railway logs
- Verify `PORT` environment variable
- Ensure `start` script exists in `package.json`

**Problem**: Database connection failing
- Verify MongoDB Atlas network access allows Railway IPs
- Check `MONGODB_URI` is correct
- Check database user permissions

**Problem**: CORS errors
- Verify `CORS_ORIGIN` includes your frontend URL
- Check for trailing slashes in URLs
- Ensure protocol matches (http vs https)

### Frontend Issues

**Problem**: API calls failing
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check browser console for errors
- Verify backend is accessible
- Check CORS configuration

**Problem**: Build failing
- Check Vercel build logs
- Ensure all dependencies are in `dependencies` (not `devDependencies`)
- Verify Node.js version compatibility

**Problem**: Images not loading
- Check image paths are correct
- Verify images are in `public` folder
- Check Next.js image optimization settings

---

## Monitoring & Maintenance

### Railway
- Monitor logs in Railway dashboard
- Set up alerts for service downtime
- Monitor resource usage

### Vercel
- Check deployment status
- Monitor build times
- Review analytics (if enabled)

### MongoDB Atlas
- Monitor database performance
- Set up alerts for connection issues
- Review usage metrics

---

## Next Steps After Deployment

1. **Set up CI/CD** - Automate deployments on git push
2. **Add monitoring** - Error tracking (Sentry, LogRocket)
3. **Set up backups** - MongoDB Atlas backups
4. **Performance optimization** - CDN, caching
5. **Security hardening** - Rate limiting, security headers

---

## Cost Estimates

### Free Tier (Development/Small Projects)
- **Vercel**: Free (100GB bandwidth, unlimited deployments)
- **Railway**: $5/month free credit (usually enough for small apps)
- **MongoDB Atlas**: Free (512MB storage)

### Production (Moderate Traffic)
- **Vercel**: Free or Pro ($20/month for more features)
- **Railway**: ~$5-20/month depending on usage
- **MongoDB Atlas**: Free tier or $9/month for M0 cluster

**Total**: ~$0-30/month for small to medium applications

---

## Alternative: Render Deployment

If you prefer Render over Railway:

### Backend on Render
1. Create account at [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repo
4. Settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add environment variables (same as Railway)
6. Deploy

### Frontend on Render
1. New → Static Site
2. Connect GitHub repo
3. Settings:
   - **Root Directory**: `client`
   - **Build Command**: `cd client && npm install && npm run build`
   - **Publish Directory**: `client/.next`
4. Add environment variables
5. Deploy

Render provides free SSL and custom domains on paid plans.

---

## Summary

You now have:
- ✅ Backend API running on Railway
- ✅ Frontend running on Vercel
- ✅ Database on MongoDB Atlas
- ✅ Environment variables configured
- ✅ CORS properly set up
- ✅ Production-ready deployment

Your application is live and accessible to users! 🎉

