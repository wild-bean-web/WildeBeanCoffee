# Clover Hosted Checkout Integration Setup Guide

This guide will help you set up and test the Clover Hosted Checkout integration for Wild Bean Coffee.

## Prerequisites

- Clover Merchant Account with POS system
- Clover Developer Account (for app configuration)
- Ecommerce API Token created in Clover Merchant Dashboard
- Private API key (CLOVER_API_KEY) from Clover
- Your Clover Merchant ID

## Step 1: Configure Clover Developer Dashboard

### Enable Hosted Checkout in Developer Dashboard

1. Log in to your **Clover Developer Dashboard** (https://www.clover.com/developers)
2. Navigate to your app → **App Settings**
3. Click **"Requested Permissions"** → Enable **"Enable online payments"** checkbox
4. Go to **"Ecommerce Settings"** → Select **"Hosted Checkout"** as Integration Type
5. Save settings

### Configure Hosted Checkout in Merchant Dashboard

1. Log in to your **Clover Merchant Dashboard**
2. Navigate to **Account & Setup** → **Hosted Checkout** (or **Settings** → **Ecommerce** → **Hosted Checkout**)
3. Customize your checkout page:
   - Business name, logo, colors
   - Customer fields (first name, last name, email, etc.)
   - Enable reCAPTCHA (recommended)
4. **Set Redirect URLs:**
   - **Success URL:** `https://wildbeancoffeeshop.com/order/success?checkoutId={CHECKOUT_ID}`
   - **Failure URL:** `https://wildbeancoffeeshop.com/order/failure`
   - **Cancel URL:** `https://wildbeancoffeeshop.com/order?canceled=true`
   
   **Note:** If you see "Invalid URL" warnings, this is normal - Clover's validator doesn't recognize the `{CHECKOUT_ID}` placeholder, but it will work at runtime. You can:
   - Try URL-encoding the placeholder: `%7BCHECKOUT_ID%7D`
   - Use a test value temporarily: `?checkoutId=test` (then change back)
   - Ignore the warning - our API call will override these URLs anyway
5. **Configure Webhook (Optional but Recommended):**
   - **Webhook URL:** `https://wildecoffeebean-production.up.railway.app/api/payments/webhook`
   - Click **"GENERATE"** to create a signing secret
   - Save the signing secret as `CLOVER_WEBHOOK_SECRET` in your backend environment

## Step 2: Configure Environment Variables

### Server Environment Variables (`server/.env`)

Add the following to your `server/.env` file:

```bash
# Clover Payment Integration
CLOVER_API_KEY=your-clover-private-token-here
CLOVER_MERCHANT_ID=your-clover-merchant-id-here
CLOVER_ENVIRONMENT=sandbox  # Use 'sandbox' for testing, 'production' for live
CLOVER_WEBHOOK_SECRET=your-webhook-signing-secret-here  # Optional, for webhook verification
```

**Important:** 
- `CLOVER_API_KEY` should be your **Private Token** from Merchant Dashboard → Ecommerce API Tokens
- Never commit your `.env` file to version control

### Client Environment Variables (`client/.env.local`)

Add the following to your `client/.env.local` file:

```bash
# Clover Payment Integration
NEXT_PUBLIC_CLOVER_MERCHANT_ID=your-clover-merchant-id-here
NEXT_PUBLIC_CLOVER_ENVIRONMENT=sandbox  # Use 'sandbox' for testing, 'production' for live
NEXT_PUBLIC_ONLINE_ORDERING_ENABLED=true  # Enable online ordering
```

**Important:**
- Merchant ID is safe to expose in the browser
- Environment must match between client and server

## Step 3: How Hosted Checkout Works

### Payment Flow

1. **Customer fills out order form** → Customer information and order details
2. **Customer clicks "Proceed to Payment"** → Backend creates a Hosted Checkout session
3. **Customer is redirected** → To Clover's secure hosted payment page
4. **Customer enters payment details** → On Clover's secure page (PCI compliant)
5. **Payment is processed** → Clover handles the entire payment
6. **Customer is redirected back** → To your success/failure/cancel page
7. **Order is created** → On success page, order is created in your database
8. **Receipt is printed** → Automatically sent to in-store printer

### Security Features

- **PCI Compliance:** Card data never touches your server - handled entirely by Clover
- **Hosted Payment Page:** Clover manages the entire payment UI securely
- **Redirect-based:** Simple, reliable flow with no iframe complexity
- **Webhook Support:** Optional real-time payment notifications

## Step 4: Testing the Integration

### Test Mode (Sandbox)

1. Set `CLOVER_ENVIRONMENT=sandbox` in both server and client `.env` files
2. Use Clover's test card numbers:
   - **Success:** `4242 4242 4242 4242`
   - **Decline:** `4000 0000 0000 0002`
   - Use any future expiry date and any 3-digit CVV
3. Test the full flow:
   - Add items to cart
   - Go to checkout (`/order`)
   - Fill in customer information
   - Click "Proceed to Payment"
   - You should be redirected to Clover's sandbox checkout page
   - Enter test card details
   - Complete payment
   - You'll be redirected back to `/order/success`
   - Verify order is created with `paymentStatus: "paid"`
   - Check that receipt printing is attempted (will fail in sandbox if printer not set up)

### Production Mode

1. Set `CLOVER_ENVIRONMENT=production` in both server and client `.env` files
2. Ensure redirect URLs in Merchant Dashboard are set to:
   - **Success URL:** `https://wildbeancoffeeshop.com/order/success?checkoutId={CHECKOUT_ID}`
   - **Failure URL:** `https://wildbeancoffeeshop.com/order/failure`
   - **Cancel URL:** `https://wildbeancoffeeshop.com/order?canceled=true`
3. Ensure your Clover POS system is fully configured
4. Test with a small real transaction first
5. Verify receipt printing works in-store

## Step 5: Set Up Printer (When POS is Ready)

Once your Clover POS system is set up in the store:

1. The system will automatically detect available printers
2. Receipts will be printed automatically after successful payment and order creation
3. If you have multiple printers, you can specify a printer ID in the print request

## Troubleshooting

### Checkout Session Creation Fails

- Verify `CLOVER_API_KEY` (private token) is correct
- Check `CLOVER_MERCHANT_ID` matches your account
- Ensure Hosted Checkout is enabled in Developer Dashboard
- Check server logs for detailed error messages
- Verify redirect URLs are properly formatted

### Redirect URLs Not Working

- Ensure URLs are absolute (include `https://`)
- Check that your frontend is accessible at those URLs
- Verify `{CHECKOUT_ID}` placeholder is included in success URL
- Test URLs manually to ensure they're accessible

### Payment Succeeds But Order Not Created

- Check `/order/success` page is loading correctly
- Verify `sessionStorage` has pending order data
- Check browser console for errors
- Review server logs for order creation errors
- Ensure order API endpoint is accessible

### Receipt Not Printing

- Verify your Clover POS system is online and connected
- Check that at least one printer is configured in your Clover account
- Receipt printing failures won't block order creation (errors are logged)
- You can manually trigger printing via the `/api/payments/print-receipt` endpoint

## API Endpoints

### `POST /api/payments/create-checkout`
Create a Hosted Checkout session.

**Request:**
```json
{
  "items": [
    { "name": "Latte", "quantity": 2, "price": 4.89 },
    { "name": "Croissant", "quantity": 1, "price": 5.50 }
  ],
  "customer": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "555-1234"
  },
   "amount": 1578,
   "successUrl": "https://wildbeancoffeeshop.com/order/success?checkoutId={CHECKOUT_ID}",
   "failureUrl": "https://wildbeancoffeeshop.com/order/failure",
   "cancelUrl": "https://wildbeancoffeeshop.com/order?canceled=true",
  "taxRate": 0.0875,
  "currency": "USD"
}
```

**Response:**
```json
{
  "data": {
    "success": true,
    "checkoutId": "checkout_123",
    "checkoutUrl": "https://checkout.clover.com/checkout/abc123",
    "expiresAt": "2024-01-15T14:30:00Z"
  }
}
```

### `POST /api/payments/webhook`
Handle Clover webhook notifications (optional).

**Note:** Webhooks are sent by Clover for payment events. The endpoint automatically acknowledges receipt.

### `POST /api/payments/print-receipt`
Print a receipt for an order.

**Request:**
```json
{
  "orderId": "order_id_here",
  "printerId": "optional_printer_id"
}
```

### `POST /api/orders`
Create a new order (called from success page after payment).

**Request:**
```json
{
  "customer": {
    "name": "John Doe",
    "phone": "555-1234",
    "email": "john@example.com"
  },
  "items": [...],
  "taxRate": 0.0875,
  "pickupTime": "2024-01-15T14:30:00",
  "notes": "Extra hot",
  "paymentStatus": "paid",
  "paymentRef": "checkout_123"
}
```

## Support

For Clover-specific issues:
- Clover Developer Documentation: https://docs.clover.com/dev/docs/hosted-checkout-api
- Clover Support: Contact through your Merchant Dashboard

For application-specific issues:
- Check server logs for detailed error messages
- Verify all environment variables are set correctly
- Ensure database connection is working
- Check browser console for frontend errors
