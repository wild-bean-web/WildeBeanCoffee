/**
 * Clover API Service
 * Handles payment processing and receipt printing via Clover API
 */

// Lazy-load configuration to ensure environment variables are loaded first
// This prevents issues with ES module hoisting where imports happen before dotenv.config()
let CLOVER_API_BASE_URL;
let CLOVER_API_KEY;
let CLOVER_MERCHANT_ID;
let configInitialized = false;

/**
 * Initialize Clover configuration (called lazily on first use)
 */
function initializeConfig() {
  if (configInitialized) {
    return;
  }

  console.log(
    "[CLOVER SERVICE] ========== INITIALIZING CONFIGURATION =========="
  );
  console.log("[CLOVER SERVICE] Loading environment variables...");

  const environment = process.env.CLOVER_ENVIRONMENT || "sandbox";
  CLOVER_API_BASE_URL =
    environment === "production"
      ? "https://api.clover.com"
      : "https://sandbox.dev.clover.com";

  CLOVER_API_KEY = process.env.CLOVER_API_KEY;
  CLOVER_MERCHANT_ID = process.env.CLOVER_MERCHANT_ID;

  console.log(
    "[CLOVER SERVICE] Environment Variables:",
    JSON.stringify(
      {
        CLOVER_ENVIRONMENT: environment,
        CLOVER_API_BASE_URL: CLOVER_API_BASE_URL,
        CLOVER_API_KEY: CLOVER_API_KEY
          ? CLOVER_API_KEY.substring(0, 10) +
            "... (length: " +
            CLOVER_API_KEY.length +
            ")"
          : "MISSING",
        CLOVER_MERCHANT_ID: CLOVER_MERCHANT_ID || "MISSING",
        apiKeyConfigured: !!CLOVER_API_KEY,
        merchantIdConfigured: !!CLOVER_MERCHANT_ID,
      },
      null,
      2
    )
  );

  if (!CLOVER_API_KEY || !CLOVER_MERCHANT_ID) {
    console.error("[CLOVER SERVICE] ⚠️  WARNING: Missing Clover credentials!");
  } else {
    console.log("[CLOVER SERVICE] ✅ All credentials configured");
  }

  console.log("[CLOVER SERVICE] ============================================");
  configInitialized = true;
}

/**
 * Get Clover API headers with authentication
 */
function getCloverHeaders() {
  initializeConfig(); // Ensure config is loaded
  return {
    Authorization: `Bearer ${CLOVER_API_KEY}`,
    "Content-Type": "application/json",
    "X-Clover-Merchant-Id": CLOVER_MERCHANT_ID,
  };
}

/**
 * Process a payment through Clover
 * @param {Object} paymentData - Payment information
 * @param {number} paymentData.amount - Amount in cents
 * @param {string} paymentData.source - Payment source token from Clover
 * @param {string} paymentData.orderId - Order ID (optional, for tracking)
 * @param {string} paymentData.currency - Currency code (default: USD)
 * @returns {Promise<Object>} Payment result
 */
export async function processPayment(paymentData) {
  console.log("[CLOVER SERVICE] ========== PROCESS PAYMENT START ==========");
  initializeConfig(); // Ensure config is loaded before use

  console.log("[CLOVER SERVICE] Step 14: Received payment data from route");
  console.log(
    "[CLOVER SERVICE] Payment data:",
    JSON.stringify(
      {
        amount: paymentData.amount,
        amountInDollars: (paymentData.amount / 100).toFixed(2),
        source: paymentData.source
          ? paymentData.source.substring(0, 30) +
            "... (length: " +
            paymentData.source.length +
            ")"
          : "MISSING",
        orderId: paymentData.orderId || "N/A",
        currency: paymentData.currency || "USD (default)",
      },
      null,
      2
    )
  );

  const { amount, source, orderId, currency = "USD" } = paymentData;

  console.log("[CLOVER SERVICE] Step 15: Validating credentials and data");
  if (!CLOVER_API_KEY || !CLOVER_MERCHANT_ID) {
    console.error("[CLOVER SERVICE] ❌ Validation FAILED: Missing credentials");
    console.error(
      "[CLOVER SERVICE] Missing:",
      JSON.stringify(
        {
          apiKey: !CLOVER_API_KEY,
          merchantId: !CLOVER_MERCHANT_ID,
        },
        null,
        2
      )
    );
    throw new Error("Clover API credentials not configured");
  }
  console.log("[CLOVER SERVICE] ✅ Credentials validation passed");

  if (!source) {
    console.error(
      "[CLOVER SERVICE] ❌ Validation FAILED: Missing source token"
    );
    throw new Error("Payment source token is required");
  }
  console.log("[CLOVER SERVICE] ✅ Source token validation passed");

  if (!amount || amount <= 0) {
    console.error(
      "[CLOVER SERVICE] ❌ Validation FAILED: Invalid amount",
      JSON.stringify({ amount }, null, 2)
    );
    throw new Error("Valid payment amount is required");
  }
  console.log("[CLOVER SERVICE] ✅ Amount validation passed");

  try {
    // Create a charge using Clover API
    const chargeUrl = `${CLOVER_API_BASE_URL}/v3/merchants/${CLOVER_MERCHANT_ID}/charges`;

    console.log("[CLOVER SERVICE] Step 16: Preparing Clover API request");
    console.log("[CLOVER SERVICE] API Endpoint:", chargeUrl);
    console.log("[CLOVER SERVICE] API Method: POST");
    console.log(
      "[CLOVER SERVICE] Current Configuration:",
      JSON.stringify(
        {
          baseUrl: CLOVER_API_BASE_URL,
          merchantId: CLOVER_MERCHANT_ID,
          apiKeyPrefix: CLOVER_API_KEY
            ? CLOVER_API_KEY.substring(0, 10) + "..."
            : "MISSING",
        },
        null,
        2
      )
    );

    const chargePayload = {
      amount: Math.round(amount), // Ensure amount is in cents
      currency: currency.toLowerCase(),
      source: source, // Payment token from Clover
      description: orderId ? `Order #${orderId}` : "Online Order",
      capture: true, // Capture immediately (not just authorize)
    };

    console.log(
      "[CLOVER SERVICE] Request Payload:",
      JSON.stringify(
        {
          amount: chargePayload.amount,
          amountInDollars: (chargePayload.amount / 100).toFixed(2),
          currency: chargePayload.currency,
          source:
            chargePayload.source.substring(0, 30) +
            "... (length: " +
            chargePayload.source.length +
            ")",
          description: chargePayload.description,
          capture: chargePayload.capture,
        },
        null,
        2
      )
    );
    console.log(
      "[CLOVER SERVICE] Full payload (JSON):",
      JSON.stringify(chargePayload, null, 2)
    );

    const headers = getCloverHeaders();
    console.log(
      "[CLOVER SERVICE] Request Headers:",
      JSON.stringify(
        {
          "Content-Type": headers["Content-Type"],
          Authorization: headers.Authorization
            ? headers.Authorization.substring(0, 20) + "..."
            : "MISSING",
        },
        null,
        2
      )
    );

    console.log("[CLOVER SERVICE] Step 17: Sending request to Clover API");
    const requestStartTime = Date.now();
    const response = await fetch(chargeUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(chargePayload),
    });
    const requestDuration = Date.now() - requestStartTime;

    console.log("[CLOVER SERVICE] Step 18: Clover API response received");
    console.log("[CLOVER SERVICE] Response duration:", requestDuration, "ms");
    console.log(
      "[CLOVER SERVICE] Response status:",
      response.status,
      response.statusText
    );
    console.log("[CLOVER SERVICE] Response OK:", response.ok);
    console.log(
      "[CLOVER SERVICE] Response headers:",
      JSON.stringify(
        {
          "content-type": response.headers.get("content-type"),
          "content-length": response.headers.get("content-length"),
        },
        null,
        2
      )
    );

    const result = await response.json();
    console.log(
      "[CLOVER SERVICE] Response body:",
      JSON.stringify(result, null, 2)
    );

    if (!response.ok) {
      console.error(
        "[CLOVER SERVICE] ❌ Step 18 FAILED: Clover API returned error"
      );
      console.error(
        "[CLOVER SERVICE] Error details:",
        JSON.stringify(
          {
            status: response.status,
            statusText: response.statusText,
            errorType: result.error?.type || "N/A",
            errorCode: result.error?.code || "N/A",
            errorMessage: result.error?.message || result.message || "N/A",
            fullError: result.error || result,
          },
          null,
          2
        )
      );
      const errorMessage =
        result.error?.message || result.message || "Payment processing failed";
      throw new Error(errorMessage);
    }

    const paymentResult = {
      success: true,
      chargeId: result.id,
      amount: result.amount,
      currency: result.currency,
      status: result.status,
      paymentRef: result.id, // Store this in order.paymentRef
    };

    console.log("[CLOVER SERVICE] ✅ Step 18 SUCCESS: Payment processed");
    console.log(
      "[CLOVER SERVICE] Payment result:",
      JSON.stringify(
        {
          success: paymentResult.success,
          chargeId: paymentResult.chargeId,
          amount: paymentResult.amount,
          amountInDollars: (paymentResult.amount / 100).toFixed(2),
          currency: paymentResult.currency,
          status: paymentResult.status,
        },
        null,
        2
      )
    );
    console.log("[CLOVER SERVICE] ========== PROCESS PAYMENT END ==========");
    console.log("═══════════════════════════════════════════════════════════");

    return paymentResult;
  } catch (error) {
    console.error(
      "[CLOVER SERVICE] ❌ PAYMENT PROCESSING ERROR:",
      error.message
    );
    console.error("[CLOVER SERVICE] Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    console.error(
      "[CLOVER SERVICE] ========== PROCESS PAYMENT END (ERROR) =========="
    );
    console.log("═══════════════════════════════════════════════════════════");
    throw error;
  }
}

/**
 * Get available printers for the merchant
 * @returns {Promise<Array>} Array of printer objects
 */
export async function getPrinters() {
  initializeConfig(); // Ensure config is loaded before use
  if (!CLOVER_API_KEY || !CLOVER_MERCHANT_ID) {
    throw new Error("Clover API credentials not configured");
  }

  try {
    const printersUrl = `${CLOVER_API_BASE_URL}/v3/merchants/${CLOVER_MERCHANT_ID}/printers`;

    const response = await fetch(printersUrl, {
      method: "GET",
      headers: getCloverHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to retrieve printers");
    }

    const result = await response.json();
    return result.elements || [];
  } catch (error) {
    console.error("Clover get printers error:", error);
    throw error;
  }
}

/**
 * Print a receipt for an order
 * @param {Object} order - Order object
 * @param {string} printerId - Optional printer ID (if not provided, uses first available printer)
 * @returns {Promise<Object>} Print result
 */
export async function printReceipt(order, printerId = null) {
  initializeConfig(); // Ensure config is loaded before use
  if (!CLOVER_API_KEY || !CLOVER_MERCHANT_ID) {
    throw new Error("Clover API credentials not configured");
  }

  try {
    // Get printer ID if not provided
    let targetPrinterId = printerId;
    if (!targetPrinterId) {
      const printers = await getPrinters();
      if (printers.length === 0) {
        throw new Error("No printers available");
      }
      targetPrinterId = printers[0].id;
    }

    // Format receipt content
    const receiptLines = formatReceiptContent(order);

    // Send print command
    const printUrl = `${CLOVER_API_BASE_URL}/v3/merchants/${CLOVER_MERCHANT_ID}/printers/${targetPrinterId}/print`;

    const printPayload = {
      lines: receiptLines,
    };

    const response = await fetch(printUrl, {
      method: "POST",
      headers: getCloverHeaders(),
      body: JSON.stringify(printPayload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to print receipt");
    }

    const result = await response.json();
    return {
      success: true,
      printerId: targetPrinterId,
      printJobId: result.id,
    };
  } catch (error) {
    console.error("Clover print receipt error:", error);
    // Don't throw - receipt printing failure shouldn't fail the order
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Format order data into receipt lines for printing
 * @param {Object} order - Order object
 * @returns {Array} Array of receipt line objects
 */
function formatReceiptContent(order) {
  const lines = [];

  // Header
  lines.push({
    type: "TEXT",
    text: "WILD BEAN COFFEE",
    align: "CENTER",
    bold: true,
  });
  lines.push({ type: "TEXT", text: "ONLINE ORDER", align: "CENTER" });
  lines.push({ type: "TEXT", text: "---", align: "CENTER" });

  // Order info
  lines.push({
    type: "TEXT",
    text: `Order #: ${order._id.toString().slice(-8)}`,
    align: "LEFT",
  });
  lines.push({
    type: "TEXT",
    text: `Customer: ${order.customer.name}`,
    align: "LEFT",
  });
  lines.push({
    type: "TEXT",
    text: `Phone: ${order.customer.phone}`,
    align: "LEFT",
  });
  if (order.customer.email) {
    lines.push({
      type: "TEXT",
      text: `Email: ${order.customer.email}`,
      align: "LEFT",
    });
  }
  if (order.pickupTime) {
    const pickupDate = new Date(order.pickupTime);
    lines.push({
      type: "TEXT",
      text: `Pickup: ${pickupDate.toLocaleString()}`,
      align: "LEFT",
    });
  }
  lines.push({ type: "TEXT", text: "---", align: "CENTER" });

  // Items
  lines.push({ type: "TEXT", text: "ITEMS:", align: "LEFT", bold: true });
  order.items.forEach((item) => {
    lines.push({
      type: "TEXT",
      text: `${item.quantity}x ${item.name}`,
      align: "LEFT",
    });
    const itemTotal = (item.price * item.quantity).toFixed(2);
    lines.push({ type: "TEXT", text: `  $${itemTotal}`, align: "RIGHT" });
  });
  lines.push({ type: "TEXT", text: "---", align: "CENTER" });

  // Totals
  lines.push({
    type: "TEXT",
    text: `Subtotal: $${order.totals.subtotal.toFixed(2)}`,
    align: "LEFT",
  });
  lines.push({
    type: "TEXT",
    text: `Tax: $${order.totals.tax.toFixed(2)}`,
    align: "LEFT",
  });
  lines.push({
    type: "TEXT",
    text: `TOTAL: $${order.totals.total.toFixed(2)}`,
    align: "LEFT",
    bold: true,
  });

  // Payment status
  if (order.paymentStatus === "paid") {
    lines.push({ type: "TEXT", text: "PAID", align: "CENTER", bold: true });
    if (order.paymentRef) {
      lines.push({
        type: "TEXT",
        text: `Payment ID: ${order.paymentRef.slice(-8)}`,
        align: "CENTER",
      });
    }
  }

  // Notes
  if (order.notes) {
    lines.push({ type: "TEXT", text: "---", align: "CENTER" });
    lines.push({ type: "TEXT", text: "NOTES:", align: "LEFT", bold: true });
    lines.push({ type: "TEXT", text: order.notes, align: "LEFT" });
  }

  // Footer
  lines.push({ type: "TEXT", text: "---", align: "CENTER" });
  lines.push({
    type: "TEXT",
    text: "Thank you for your order!",
    align: "CENTER",
  });
  lines.push({
    type: "TEXT",
    text: new Date().toLocaleString(),
    align: "CENTER",
  });

  return lines;
}

/**
 * Create a Hosted Checkout session
 * @param {Object} checkoutData - Checkout information
 * @param {Array} checkoutData.items - Array of items with name, quantity, price
 * @param {Object} checkoutData.customer - Customer information (firstName, email required; lastName optional for Clover uses "." if empty)
 * @param {number} checkoutData.amount - Total amount in cents
 * @param {string} checkoutData.successUrl - URL to redirect after successful payment
 * @param {string} checkoutData.failureUrl - URL to redirect after failed payment
 * @param {string} checkoutData.cancelUrl - URL to redirect if payment is cancelled
 * @param {number} checkoutData.taxRate - Tax rate (optional, e.g., 0.0875 for 8.75%)
 * @param {string} checkoutData.currency - Currency code (default: USD)
 * @returns {Promise<Object>} Checkout session with URL
 */
export async function createHostedCheckoutSession(checkoutData) {
  console.log(
    "[CLOVER SERVICE] ========== CREATE HOSTED CHECKOUT SESSION =========="
  );
  initializeConfig(); // Ensure config is loaded before use

  const {
    items,
    customer,
    amount,
    successUrl,
    failureUrl,
    cancelUrl,
    taxRate = 0,
    currency = "USD",
  } = checkoutData;

  console.log(
    "[CLOVER SERVICE] Checkout data:",
    JSON.stringify(
      {
        itemCount: items?.length || 0,
        customerName: [customer?.firstName, customer?.lastName]
          .map((s) => (s || "").trim())
          .filter(Boolean)
          .join(" ") || "N/A",
        customerEmail: customer?.email || "N/A",
        amount: amount,
        amountInDollars: amount ? (amount / 100).toFixed(2) : "N/A",
        taxRate: taxRate,
        currency: currency,
        successUrl: successUrl || "MISSING",
        failureUrl: failureUrl || "MISSING",
        cancelUrl: cancelUrl || "MISSING",
      },
      null,
      2
    )
  );

  // Validation
  if (!CLOVER_API_KEY || !CLOVER_MERCHANT_ID) {
    console.error("[CLOVER SERVICE] ❌ Missing Clover credentials");
    throw new Error("Clover API credentials not configured");
  }

  if (!items || items.length === 0) {
    throw new Error("Checkout items are required");
  }

  const firstName = (customer?.firstName || "").trim();
  const lastNameRaw = (customer?.lastName || "").trim();
  const email = (customer?.email || "").trim();
  if (!customer || !firstName || !email) {
    throw new Error(
      "Customer information (firstName, email) is required; lastName is optional"
    );
  }
  /** Clover expects a lastName string; use placeholder when guest omits it. */
  const lastNameForClover = lastNameRaw || ".";

  if (!amount || amount <= 0) {
    throw new Error("Valid payment amount is required");
  }

  if (!successUrl || !failureUrl || !cancelUrl) {
    throw new Error("Success, failure, and cancel URLs are required");
  }

  try {
    // Calculate line items for Clover
    // Note: Clover uses 'unitQty' not 'quantity', and price is in cents
    const lineItems = items.map((item) => ({
      name: item.name,
      unitQty: item.quantity || 1,
      price: Math.round((item.price || 0) * 100), // Convert to cents
    }));

    // Calculate totals for logging
    const subtotal = lineItems.reduce(
      (sum, item) => sum + item.price * item.unitQty,
      0
    );
    const taxAmount = Math.round(subtotal * taxRate);
    const totalAmount = subtotal + taxAmount;

    // Clover calculates the total automatically, but we validate it matches
    const finalAmount = Math.round(amount);

    console.log(
      "[CLOVER SERVICE] Calculated totals:",
      JSON.stringify(
        {
          subtotal: subtotal,
          subtotalInDollars: (subtotal / 100).toFixed(2),
          taxAmount: taxAmount,
          taxAmountInDollars: (taxAmount / 100).toFixed(2),
          totalAmount: totalAmount,
          totalAmountInDollars: (totalAmount / 100).toFixed(2),
          providedAmount: finalAmount,
          providedAmountInDollars: (finalAmount / 100).toFixed(2),
        },
        null,
        2
      )
    );

    // Create checkout session payload (Clover Hosted Checkout API format)
    // Note: redirectUrls can be set in API call OR Merchant Dashboard
    // If set in Merchant Dashboard, those URLs override the API call URLs
    // Clover requires HTTPS URLs, so we only include redirectUrls if they're HTTPS
    // Tax rate must be an integer where 10% = 1000000 (so 0.06 = 600000)
    const checkoutPayload = {
      customer: {
        firstName,
        lastName: lastNameForClover,
        email,
        phoneNumber: customer.phone || undefined,
      },
      shoppingCart: {
        lineItems: lineItems,
      },
      taxRates:
        taxRate > 0
          ? [
              {
                name: "Tax",
                rate: Math.round(taxRate * 10000000), // Convert to Clover's format (0.06 = 600000 for 6%)
              },
            ]
          : [],
    };

    // Only include redirectUrls if they're HTTPS (Clover requires HTTPS)
    // For localhost development, omit redirectUrls and use Merchant Dashboard URLs instead
    if (successUrl.startsWith("https://") && failureUrl.startsWith("https://")) {
      checkoutPayload.redirectUrls = {
        success: successUrl,
        failure: failureUrl,
      };
    } else {
      console.log("[CLOVER SERVICE] ⚠️  Redirect URLs are not HTTPS, omitting from API call");
      console.log("[CLOVER SERVICE] Using Merchant Dashboard redirect URLs instead");
    }

    console.log(
      "[CLOVER SERVICE] Checkout payload:",
      JSON.stringify(checkoutPayload, null, 2)
    );

    // Create checkout session via Clover API
    // Note: Merchant ID goes in header, not URL path
    const checkoutUrl = `${CLOVER_API_BASE_URL}/invoicingcheckoutservice/v1/checkouts`;

    console.log("[CLOVER SERVICE] API Endpoint:", checkoutUrl);
    console.log("[CLOVER SERVICE] Sending request to Clover API...");

    const headers = getCloverHeaders();

    // Log request details (without sensitive data)
    console.log(
      "[CLOVER SERVICE] Request headers:",
      JSON.stringify(
        {
          Authorization: headers.Authorization
            ? `Bearer ${headers.Authorization.substring(7, 17)}...`
            : "MISSING",
          "Content-Type": headers["Content-Type"],
          "X-Clover-Merchant-Id": headers["X-Clover-Merchant-Id"],
        },
        null,
        2
      )
    );

    const response = await fetch(checkoutUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(checkoutPayload),
    });

    console.log(
      "[CLOVER SERVICE] Response status:",
      response.status,
      response.statusText
    );

    let result;
    try {
      const responseText = await response.text();
      console.log("[CLOVER SERVICE] Response body (raw):", responseText);

      if (responseText && responseText.length > 0) {
        result = JSON.parse(responseText);
        console.log(
          "[CLOVER SERVICE] Response body (parsed):",
          JSON.stringify(result, null, 2)
        );
      } else {
        result = {};
      }
    } catch (parseError) {
      console.error(
        "[CLOVER SERVICE] ❌ Failed to parse Clover response:",
        parseError
      );
      throw new Error(
        `Failed to parse Clover API response: ${parseError.message}`
      );
    }

    if (!response.ok) {
      console.error("[CLOVER SERVICE] ❌ Failed to create checkout session");
      console.error(
        "[CLOVER SERVICE] Response Status:",
        response.status,
        response.statusText
      );
      console.error("[CLOVER SERVICE] Response URL:", checkoutUrl);
      console.error(
        "[CLOVER SERVICE] Clover API Error Response:",
        JSON.stringify(result, null, 2)
      );

      // Extract error message from Clover's response
      let errorMessage = `Clover API error: ${response.status} ${response.statusText}`;
      if (result) {
        if (result.error) {
          errorMessage =
            typeof result.error === "string"
              ? result.error
              : result.error.message || result.error.code || errorMessage;
        } else if (result.message) {
          errorMessage = result.message;
        } else if (result.code) {
          errorMessage = result.code;
        }
      }

      // Add more context for common errors
      if (response.status === 401 || response.status === 403) {
        errorMessage = `Clover API Authentication Failed: ${errorMessage}. Please verify your CLOVER_API_KEY and CLOVER_MERCHANT_ID are correct.`;
      } else if (response.status === 404) {
        errorMessage = `Clover API Endpoint Not Found: ${errorMessage}. Please verify:
1. Your CLOVER_MERCHANT_ID (${CLOVER_MERCHANT_ID}) is correct
2. Your API key has access to this merchant
3. The endpoint URL is correct: ${checkoutUrl}
4. Your CLOVER_ENVIRONMENT (${
          process.env.CLOVER_ENVIRONMENT || "sandbox"
        }) matches your API key type`;
      }

      throw new Error(errorMessage);
    }

    // Clover returns the checkout URL in 'href' field and session ID in 'checkoutSessionId'
    const checkoutSession = {
      success: true,
      checkoutId: result.checkoutSessionId || result.id,
      checkoutUrl: result.href,
      expiresAt: result.expirationTime || result.expiresAt,
      createdTime: result.createdTime,
    };

    console.log("[CLOVER SERVICE] ✅ Checkout session created successfully");
    console.log("[CLOVER SERVICE] Checkout URL:", checkoutSession.checkoutUrl);
    console.log(
      "[CLOVER SERVICE] ============================================"
    );

    return checkoutSession;
  } catch (error) {
    console.error(
      "[CLOVER SERVICE] ❌ Error creating checkout session:",
      error.message
    );
    console.error(
      "[CLOVER SERVICE] Error details:",
      JSON.stringify(
        {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        null,
        2
      )
    );
    console.error(
      "[CLOVER SERVICE] ============================================"
    );
    throw error;
  }
}
