# Payment System Debugging Guide

## Technical Flow Overview

### Frontend (Client-Side) Flow

1. **User Input** → Payment Information
   - Customer enters payment details
   - Payment information is securely processed
   - No card data touches our servers (PCI compliance)

2. **Payment Processing** → Backend API
   - Payment request is sent to `/api/payments/process`
   - Backend processes payment via Clover API

### Backend (Server-Side) Flow

1. **Receive Payment Request** → Validate & Prepare
   - Validate payment data exists and amount is valid
   - Prepare charge request payload

2. **Clover API Call** → `POST /v3/merchants/{merchantId}/charges`
   - Send charge request with payment token
   - Clover processes the payment
   - Returns success or error response

## Why Invalid Card Information Fails

### Technical Reasons:

1. **Client-Side Validation**
   - Payment information is validated before processing
   - Invalid cards may cause validation errors
   - Invalid formats will be rejected

2. **Backend Processing**
   - Clover API validates all payment information
   - Invalid card numbers, expired cards, or declined cards will fail
   - Error messages are returned from Clover API

3. **Error Handling**
   - All errors are logged for debugging
   - User-friendly error messages are displayed
   - Failed payments don't create orders

## Debugging Steps

### Check Server Logs

Look for these log entries:
- `[CLOVER SERVICE]` - Clover service operations
- `[PAYMENT ROUTE]` - Payment route handling
- Error messages with stack traces

### Check Environment Variables

Verify these are set correctly:
- `CLOVER_API_KEY` - Private token from Merchant Dashboard
- `CLOVER_MERCHANT_ID` - Your merchant ID
- `CLOVER_ENVIRONMENT` - Must match between client and server

### Test Payment Flow

1. Check that payment endpoint is accessible
2. Verify Clover API credentials are valid
3. Test with Clover test cards in sandbox mode
4. Check network requests in browser DevTools

## Common Issues

### Payment Processing Fails

**Symptoms:**
- Payment request returns error
- Order not created

**Solutions:**
- Verify `CLOVER_API_KEY` is correct
- Check `CLOVER_MERCHANT_ID` matches your account
- Ensure environment (sandbox/production) matches
- Check server logs for specific error messages

### Invalid Payment Token

**Symptoms:**
- "Payment source token is required" error
- Token validation fails

**Solutions:**
- Verify payment token is being generated correctly
- Check token format matches Clover requirements
- Ensure token hasn't expired

### Network Errors

**Symptoms:**
- Timeout errors
- Connection refused
- CORS errors

**Solutions:**
- Check internet connection
- Verify Clover API endpoints are accessible
- Check CORS configuration
- Verify environment URLs are correct

## Logging

All payment operations are logged with detailed information:
- Request/response data
- Error messages and stack traces
- Configuration values (masked for security)
- Processing steps and timing

Check server console for detailed debugging information.
