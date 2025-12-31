# Payment System Debugging Guide

## Technical Flow Overview

### Frontend (Client-Side) Flow

1. **User Input** → Clover iFrame Elements
   - Card number, expiry, CVV are entered into Clover-hosted iframes
   - These iframes communicate directly with Clover's servers
   - No card data touches our servers (PCI compliance)

2. **Token Creation** → `cloverRef.current.createToken()`
   - Clover SDK validates the card information client-side
   - If valid, Clover creates a secure token representing the card
   - This token is safe to send to our backend (not actual card data)

3. **Payment Processing** → Backend API
   - Token is sent to `/api/payments/process`
   - Backend uses token to charge the card via Clover API

### Backend (Server-Side) Flow

1. **Receive Token** → Validate & Prepare
   - Validate token exists and amount is valid
   - Prepare charge request payload

2. **Clover API Call** → `POST /v3/merchants/{merchantId}/charges`
   - Send charge request with token
   - Clover processes the payment
   - Returns success or error response

## Why Invalid Card Information Fails

### Technical Reasons:

1. **Client-Side Validation (Clover SDK)**
   - Clover SDK validates card format (Luhn algorithm, expiry date, etc.)
   - Invalid cards may cause `createToken()` to:
     - Return validation errors immediately
     - Hang/timeout if validation is slow
     - Fail silently in some cases

2. **Token Creation Timeout**
   - If Clover SDK can't validate the card, `createToken()` may not resolve
   - Our 30-second timeout prevents infinite hanging
   - This is why you see "Payment processing is taking longer than expected"

3. **Backend Processing**
   - Even if a token is created, Clover API may reject it
   - Invalid card numbers, expired cards, or declined cards will fail
   - Clover returns specific error codes we can log

## What We're Logging Now

### Frontend Logs (`[PAYMENT FORM]`)

1. **Component Initialization**
   - Clover SDK loading status
   - Configuration (environment, keys)
   - Element mounting status

2. **Token Creation**
   - Card element states before token creation
   - Full Clover SDK response object
   - Validation errors (if any)
   - Timeout detection

3. **Payment Submission**
   - Request payload sent to backend
   - Response from backend
   - Error details

### Backend Logs (`[CLOVER SERVICE]`)

1. **Request Details**
   - Full URL, method, headers
   - Complete request payload (amount, token, currency)
   - Request timing

2. **Response Details**
   - HTTP status code and status text
   - Response headers
   - Raw response text
   - Parsed JSON response

3. **Error Details** (if any)
   - Error type (card_error, api_error, etc.)
   - Error code (card_declined, invalid_number, etc.)
   - Error message
   - Decline codes (if applicable)
   - Parameter that caused error

### API Route Logs (`[PAYMENT ROUTE]`)

1. **Request Reception**
   - Request body validation
   - Parameter checks

2. **Service Calls**
   - Calls to Clover service functions
   - Results and errors

## What to Look For When Debugging

### Invalid Card Information Scenarios:

1. **Timeout at Token Creation**
   - Check: `[PAYMENT FORM] Token creation completed in X ms`
   - If > 30000ms, it timed out
   - Look for: Card element states, Clover SDK response

2. **Validation Errors from Clover SDK**
   - Check: `[PAYMENT FORM] CLOVER VALIDATION ERRORS`
   - Look for: Error type, code, message, field
   - These are client-side validation errors

3. **Backend API Errors**
   - Check: `[CLOVER SERVICE] CLOVER API ERROR DETAILS`
   - Look for: Error type, code, message, decline_code
   - These are server-side processing errors

4. **Network Issues**
   - Check: `[CLOVER SERVICE] NETWORK/FETCH ERROR`
   - Look for: Connection failures, timeouts, network errors

## Expected Clover Error Codes

### Common Error Types:
- `card_error` - Problem with the card
- `api_error` - Problem with Clover's API
- `authentication_error` - Problem with API credentials
- `invalid_request_error` - Problem with request format

### Common Error Codes:
- `invalid_number` - Card number is invalid
- `invalid_expiry_month` - Expiry month is invalid
- `invalid_expiry_year` - Expiry year is invalid
- `invalid_cvc` - CVV is invalid
- `card_declined` - Card was declined
- `insufficient_funds` - Not enough funds
- `expired_card` - Card has expired

## Next Steps for Testing

1. **Test with Invalid Card Number**
   - Enter: `1234 5678 9012 3456`
   - Watch for: Clover SDK validation errors or timeout
   - Check logs for: Error type and message

2. **Test with Invalid Expiry**
   - Enter: Past date (e.g., 01/20)
   - Watch for: Immediate validation error
   - Check logs for: Expiry validation error

3. **Test with Invalid CVV**
   - Enter: `12` (too short)
   - Watch for: Validation error
   - Check logs for: CVV validation error

4. **Test with Valid Test Card**
   - Use Clover test card: `4242 4242 4242 4242`
   - Watch for: Successful token creation and payment
   - Check logs for: Success response details

## Understanding the Logs

All logs are prefixed with:
- `[PAYMENT FORM]` - Frontend/client-side
- `[CLOVER SERVICE]` - Backend service layer
- `[PAYMENT ROUTE]` - API route handlers

Look for:
- `==========` - Section separators for major operations
- `✅` - Success indicators
- `❌` - Error indicators
- `⚠️` - Warning indicators

