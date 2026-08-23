# Deployment Checklist

Quick reference checklist for deploying Wild Bean Coffee.

## Production Release (version bump)

Before every production deploy, bump the app version from the **repo root**:

```bash
npm run release:patch   # 0.1.0 → 0.1.1 (typical bugfix / small release)
npm run release:minor   # 0.1.0 → 0.2.0 (new features)
npm run release:major   # 0.1.0 → 1.0.0 (breaking changes)
```

Then commit, tag, and push so Vercel/Railway deploy the new version:

```bash
git add version.json package.json client/package.json server/package.json
git commit -m "Release v0.1.1"
git tag v0.1.1
git push && git push origin v0.1.1
```

The version appears in the site footer and on `GET /health` (`version` field).

---

## Local development

Local `npm run dev` uses **`wildcoffeebean_TEST`** (`MONGODB_TEST_URI` in `server/.env`).

**Refresh menu without losing signed-up users:**

```bash
cd server && npm run seed:test
```

- Clears and reseeds: products, menu items, locations, modifier groups
- Preserves: users, email verifications, password resets, orders

Running `npm test` against the same database also preserves user accounts (only catalog data is cleared between tests).

**Do not** run `npm run seed` locally for menu refresh — that targets production (`MONGODB_URI`).

---

## Pre-Deployment

- [ ] **Version bumped** (`npm run release:patch` from repo root, then commit + tag — see below)
- [ ] All tests passing (`npm test` in both client and server)
- [ ] Environment variables documented
- [ ] Production MongoDB Atlas database created
- [ ] Production database user created with proper permissions
- [ ] `.env.production` files created (not committed to git)

## Backend Deployment (Railway)

- [ ] Railway account created
- [ ] Project created and connected to GitHub
- [ ] Service deployed from `server` directory
- [ ] Environment variables set:
  - [ ] `PORT=4000`
  - [ ] `MONGODB_URI` (production URI)
  - [ ] `MONGO_MAX_RETRIES=5`
  - [ ] `MONGO_RETRY_DELAY_MS=1000`
  - [ ] `CORS_ORIGIN` (will update after frontend deploy)
  - [ ] `NODE_ENV=production`
- [ ] Backend URL saved
- [ ] Health endpoint tested: `/health`
- [ ] Database connection verified in logs

## Frontend Deployment (Vercel)

- [ ] Vercel account created
- [ ] Project imported from GitHub
- [ ] Root directory set to `client`
- [ ] Environment variables set:
  - [ ] `NEXT_PUBLIC_API_URL` (Railway backend URL)
- [ ] Build successful
- [ ] Frontend URL saved
- [ ] Frontend accessible

## Post-Deployment Configuration

- [ ] Backend `CORS_ORIGIN` updated with frontend URL
- [ ] MongoDB Atlas network access configured (allow Railway IPs)
- [ ] Frontend tested - pages load correctly
- [ ] API calls working (check browser DevTools)
- [ ] No CORS errors in console
- [ ] Critical flows tested:
  - [ ] Browse products
  - [ ] Browse menu
  - [ ] Add to cart
  - [ ] View location
  - [ ] Submit order

## Database

- [ ] Production database seeded (if needed)
- [ ] Test data removed (if any)
- [ ] Database backups configured (MongoDB Atlas)

## Monitoring

- [ ] Railway logs monitored
- [ ] Vercel deployment status checked
- [ ] Error tracking set up (optional)

## Custom Domain (Optional)

- [ ] Domain purchased/configured
- [ ] DNS records updated
- [ ] SSL certificate active (automatic with Vercel)
- [ ] Environment variables updated with custom domain

## Security

- [ ] Environment variables secured (not in git)
- [ ] CORS properly configured
- [ ] MongoDB Atlas network access restricted (if possible)
- [ ] API keys secured

## Documentation

- [ ] Deployment URLs documented
- [ ] Environment variables documented
- [ ] Team members have access to deployment platforms

---

## Quick Commands

### Test Backend Locally
```bash
cd server
npm start
# Visit http://localhost:4000/health
```

### Test Frontend Locally
```bash
cd client
npm run build
npm start
# Visit http://localhost:3000
```

### Seed Production Database (via Railway CLI)
```bash
railway login
railway link
railway run npm run seed
```

### Check Backend Logs (Railway)
- Dashboard → Your service → Logs

### Check Frontend Logs (Vercel)
- Dashboard → Your project → Deployments → View logs

---

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Backend won't start | Check Railway logs, verify PORT env var |
| Database connection fails | Check MongoDB Atlas network access, verify URI |
| CORS errors | Update CORS_ORIGIN in Railway with frontend URL |
| API calls fail | Verify NEXT_PUBLIC_API_URL in Vercel |
| Build fails | Check Vercel build logs, verify dependencies |

