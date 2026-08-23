# Deployment Quick Start

**TL;DR**: Bump version, deploy backend to Railway, frontend to Vercel, configure environment variables.

## Before you deploy to production

From the repo root, bump the app version and commit:

```bash
npm run release:patch
git add version.json package.json client/package.json server/package.json
git commit -m "Release v0.1.1"
git tag v0.1.1
git push && git push origin v0.1.1
```

See [deployment-checklist.md](./deployment-checklist.md) for details.

## 5-Minute Deployment

### 1. Backend (Railway) - 2 minutes
1. Go to [railway.app](https://railway.app) → Sign up with GitHub
2. New Project → Deploy from GitHub → Select your repo
3. Set root directory to `server`
4. Add environment variables:
   ```
   PORT=4000
   MONGODB_URI=your_production_mongodb_uri
   CORS_ORIGIN=* (update after frontend deploy)
   NODE_ENV=production
   ```
5. Save backend URL (e.g., `https://xxx.railway.app`)

### 2. Frontend (Vercel) - 2 minutes
1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Import Project → Select your repo
3. Set root directory to `client`
4. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL=https://xxx.railway.app
   ```
5. Deploy → Save frontend URL

### 3. Connect Them - 1 minute
1. Go back to Railway
2. Update `CORS_ORIGIN` with your Vercel URL
3. Railway auto-restarts

### 4. Test
- Visit your Vercel URL
- Check browser console for errors
- Test a few pages

**Done!** 🎉

---

## Detailed Steps

See [deployment-guide.md](./deployment-guide.md) for comprehensive instructions.

## Troubleshooting

See [deployment-guide.md](./deployment-guide.md#troubleshooting) section.

