# Deployment Environment Variables Checklist

This document lists all required environment variables for production deployment.

## Railway (Backend) Environment Variables

Add these in Railway Dashboard → Your Service → Variables:

### Required Variables (You Already Have):
- ✅ `CORS_ORIGIN` - Your frontend domain(s), comma-separated
  - Example: `https://yourdomain.com,https://www.yourdomain.com`
- ✅ `MONGODB_URI` - Your MongoDB Atlas connection string
- ✅ `NODE_ENV` - Set to `production`
- ✅ `PORT` - Railway usually sets this automatically, but you can set it to `4000`

### Additional Required Variables (Add These):

**JWT Secret** (if not already set):
```
JWT_SECRET=your-random-secret-key-here
```
*Generate with: `openssl rand -hex 32`*

**Clover Payment Integration** (Required for payments):
```
CLOVER_API_KEY=your-clover-private-token-here
CLOVER_MERCHANT_ID=your-clover-merchant-id-here
CLOVER_ENVIRONMENT=production
```

**Optional MongoDB Settings** (if you want to customize):
```
MONGO_MAX_RETRIES=5
MONGO_RETRY_DELAY_MS=1000
```

### Complete Railway Environment Variables List:
```
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/wildbeancoffee?retryWrites=true&w=majority
NODE_ENV=production
PORT=4000
JWT_SECRET=your-jwt-secret-here
CLOVER_API_KEY=your-clover-private-token-here
CLOVER_MERCHANT_ID=your-clover-merchant-id-here
CLOVER_ENVIRONMENT=production
MONGO_MAX_RETRIES=5
MONGO_RETRY_DELAY_MS=1000
```

---

## Frontend Hosting (Parcel/Vercel/Netlify/etc.) Environment Variables

Add these in your hosting platform's environment variables settings:

### Required Variables (You Already Have):
- ✅ `NEXT_PUBLIC_API_URL` - Your Railway backend URL
  - Example: `https://your-app-name.railway.app`

### Additional Required Variables (Add These):

**Clover Payment Integration** (Required for payments):
```
NEXT_PUBLIC_CLOVER_PUBLIC_KEY=your-clover-public-token-here
NEXT_PUBLIC_CLOVER_MERCHANT_ID=your-clover-merchant-id-here
NEXT_PUBLIC_CLOVER_ENVIRONMENT=production
```

### Complete Frontend Environment Variables List:
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NEXT_PUBLIC_CLOVER_PUBLIC_KEY=your-clover-public-token-here
NEXT_PUBLIC_CLOVER_MERCHANT_ID=your-clover-merchant-id-here
NEXT_PUBLIC_CLOVER_ENVIRONMENT=production
```

---

## Important Notes

### Clover Credentials:
- **Private Token** (`CLOVER_API_KEY`) → Goes in **Railway (Backend)** only
- **Public Token** (`NEXT_PUBLIC_CLOVER_PUBLIC_KEY`) → Goes in **Frontend** only
- **Merchant ID** → Goes in both (safe to expose in frontend)
- **Environment** → Use `sandbox` for testing, `production` for live

### Security:
- ✅ Never commit `.env` files to git
- ✅ Private tokens should only be in backend (Railway)
- ✅ Public tokens are safe to expose in frontend (they're designed for client-side use)
- ✅ Always use HTTPS in production

### Testing:
- Start with `CLOVER_ENVIRONMENT=sandbox` in both environments
- Test thoroughly before switching to `production`
- Use Clover test cards: `4242 4242 4242 4242`

---

## Quick Setup Steps

### 1. Railway (Backend)
1. Go to Railway Dashboard → Your Service → Variables
2. Add the Clover variables:
   - `CLOVER_API_KEY` (your private token)
   - `CLOVER_MERCHANT_ID`
   - `CLOVER_ENVIRONMENT` (start with `sandbox`)
3. Add `JWT_SECRET` if not already set
4. Verify `CORS_ORIGIN` includes your frontend domain

### 2. Frontend (Parcel/Vercel/etc.)
1. Go to your hosting platform's environment variables settings
2. Add the Clover variables:
   - `NEXT_PUBLIC_CLOVER_PUBLIC_KEY` (your public token)
   - `NEXT_PUBLIC_CLOVER_MERCHANT_ID`
   - `NEXT_PUBLIC_CLOVER_ENVIRONMENT` (start with `sandbox`)
3. Verify `NEXT_PUBLIC_API_URL` points to your Railway backend

### 3. Redeploy
- Railway will auto-restart when you add variables
- Frontend may need a manual redeploy to pick up new environment variables

---

## Verification Checklist

After setting up environment variables:

- [ ] Backend starts without errors (check Railway logs)
- [ ] Frontend builds successfully (check build logs)
- [ ] Payment form loads on checkout page
- [ ] Can process test payment in sandbox mode
- [ ] Receipt printing works (once POS is set up)
- [ ] CORS errors are resolved (check browser console)

---

## Troubleshooting

### Payment form not loading:
- Check that `NEXT_PUBLIC_CLOVER_PUBLIC_KEY` is set correctly
- Verify `NEXT_PUBLIC_CLOVER_ENVIRONMENT` matches your Clover account
- Check browser console for errors

### Payment processing fails:
- Verify `CLOVER_API_KEY` (private token) is correct in Railway
- Check that `CLOVER_MERCHANT_ID` matches in both environments
- Review Railway logs for detailed error messages

### CORS errors:
- Ensure `CORS_ORIGIN` in Railway includes your exact frontend domain
- Include both `https://yourdomain.com` and `https://www.yourdomain.com` if needed
- No trailing slashes in CORS_ORIGIN

