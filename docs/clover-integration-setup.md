# Clover Payment Integration Setup Guide

This guide will help you set up and test the Clover payment integration for Wild Bean Coffee.

## Prerequisites

- Clover Merchant Account with POS system
- Ecommerce API Token created in Clover Dashboard (Hosted iFrame + API/SDK type)
- Both Public and Private API keys from Clover
- Your Clover Merchant ID

## Step 1: Configure Environment Variables

### Server Environment Variables (`server/.env`)

Add the following to your `server/.env` file:

```bash
# Clover Payment Integration
CLOVER_API_KEY=your-clover-private-token-here
CLOVER_MERCHANT_ID=your-clover-merchant-id-here
CLOVER_ENVIRONMENT=sandbox  # Use 'sandbox' for testing, 'production' for live
```

**Important:** 
- `CLOVER_API_KEY` should be your **Private Token** (used for server-side API calls)
- Never commit your `.env` file to version control

### Client Environment Variables (`client/.env.local`)

Add the following to your `client/.env.local` file:

```bash
# Clover Payment Integration (Public Key - Safe to expose)
NEXT_PUBLIC_CLOVER_PUBLIC_KEY=your-clover-public-token-here
NEXT_PUBLIC_CLOVER_MERCHANT_ID=your-clover-merchant-id-here
NEXT_PUBLIC_CLOVER_ENVIRONMENT=sandbox  # Use 'sandbox' for testing, 'production' for live
```

**Important:**
- `NEXT_PUBLIC_CLOVER_PUBLIC_KEY` should be your **Public Token** (PAKMS key - used for client-side iFrame)
- This is safe to expose in the browser as it's designed for client-side use

## Step 2: Enable reCAPTCHA (Optional but Recommended)

1. Log in to your Clover Merchant Dashboard
2. Navigate to **Account & Setup** > **Ecommerce API Tokens**
3. Find your token and enable **"Use reCAPTCHA for all transactions made through iFrame embedded page"**
4. Share your Merchant ID with Clover support if required for reCAPTCHA integration

## Step 3: Set Up Printer (When POS is Ready)

Once your Clover POS system is set up in the store:

1. The system will automatically detect available printers
2. Receipts will be printed automatically after successful payment and order creation
3. If you have multiple printers, you can specify a printer ID in the print request

## Step 4: Testing the Integration

### Test Mode (Sandbox)

1. Set `CLOVER_ENVIRONMENT=sandbox` in both server and client `.env` files
2. Use Clover's test card numbers:
   - **Success:** `4242 4242 4242 4242`
   - **Decline:** `4000 0000 0000 0002`
   - Use any future expiry date and any 3-digit CVV
3. Test the full flow:
   - Add items to cart
   - Go to checkout
   - Fill in customer information
   - Complete payment
   - Verify order is created with `paymentStatus: "paid"`
   - Check that receipt printing is attempted (will fail in sandbox if printer not set up)

### Production Mode

1. Set `CLOVER_ENVIRONMENT=production` in both server and client `.env` files
2. Ensure your Clover POS system is fully configured
3. Test with a small real transaction first
4. Verify receipt printing works in-store

## How It Works

### Payment Flow

1. **Customer fills out order form** → Customer information and order details
2. **Customer clicks "Continue to Payment"** → Payment form appears
3. **Customer enters card details** → Securely processed through Clover iFrame
4. **Payment is processed** → Backend calls Clover API to charge the card
5. **Order is created** → Only after successful payment
6. **Receipt is printed** → Automatically sent to in-store printer

### Security Features

- **PCI Compliance:** Card data never touches your server - handled entirely by Clover
- **Token-based:** Payment uses secure tokens, not raw card data
- **Server-side processing:** Actual payment processing happens on your secure backend
- **reCAPTCHA:** Optional protection against automated attacks

## Troubleshooting

### Payment Form Not Loading

- Check that `NEXT_PUBLIC_CLOVER_PUBLIC_KEY` is set correctly
- Verify the Clover SDK script is loading (check browser console)
- Ensure you're using the correct environment (sandbox vs production)

### Payment Processing Fails

- Verify `CLOVER_API_KEY` (private token) is correct
- Check `CLOVER_MERCHANT_ID` matches your account
- Ensure the token has the correct permissions
- Check server logs for detailed error messages

### Receipt Not Printing

- Verify your Clover POS system is online and connected
- Check that at least one printer is configured in your Clover account
- Receipt printing failures won't block order creation (errors are logged)
- You can manually trigger printing via the `/api/payments/print-receipt` endpoint

### Order Creation Fails After Payment

- This is a critical error - payment was successful but order wasn't created
- Check server logs for the specific error
- You may need to manually create the order or process a refund
- Contact support if this occurs

## API Endpoints

### `POST /api/payments/process`
Process a payment through Clover.

**Request:**
```json
{
  "amount": 25.50,
  "source": "token_from_clover_iframe",
  "currency": "USD"
}
```

**Response:**
```json
{
  "data": {
    "success": true,
    "chargeId": "charge_123",
    "amount": 2550,
    "currency": "usd",
    "status": "succeeded",
    "paymentRef": "charge_123"
  }
}
```

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
Create a new order (requires payment to be completed first).

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
  "paymentRef": "charge_123"
}
```

## Support

For Clover-specific issues:
- Clover Developer Documentation: https://docs.clover.com
- Clover Support: Contact through your Merchant Dashboard

For application-specific issues:
- Check server logs for detailed error messages
- Verify all environment variables are set correctly
- Ensure database connection is working

