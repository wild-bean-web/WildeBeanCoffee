"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

/**
 * PaymentForm Component
 * Integrates Clover Hosted iFrame + API/SDK for secure payment processing
 */
export default function PaymentForm({ amount, onPaymentSuccess, onPaymentError, disabled = false }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sdkReady, setSdkReady] = useState(false);
  const cloverRef = useRef(null);
  const cardNumberRef = useRef(null);
  const cardExpiryRef = useRef(null);
  const cardCvvRef = useRef(null);
  const initializedRef = useRef(false);
  const scriptLoadedRef = useRef(false);

  // Clover configuration
  const CLOVER_PUBLIC_KEY = process.env.NEXT_PUBLIC_CLOVER_PUBLIC_KEY;
  const CLOVER_MERCHANT_ID = process.env.NEXT_PUBLIC_CLOVER_MERCHANT_ID;
  const CLOVER_ENVIRONMENT = process.env.NEXT_PUBLIC_CLOVER_ENVIRONMENT || 'sandbox';
  const CLOVER_SDK_URL = CLOVER_ENVIRONMENT === 'production'
    ? 'https://checkout.clover.com/sdk.js'
    : 'https://checkout.sandbox.dev.clover.com/sdk.js';

  useEffect(() => {
    console.log('[PAYMENT FORM] ========== COMPONENT INITIALIZATION ==========');
    console.log('[PAYMENT FORM] Component mounted, checking configuration...');
    console.log('[PAYMENT FORM] Environment variables:', JSON.stringify({
      CLOVER_ENVIRONMENT: CLOVER_ENVIRONMENT,
      CLOVER_SDK_URL: CLOVER_SDK_URL,
      CLOVER_PUBLIC_KEY: CLOVER_PUBLIC_KEY ? CLOVER_PUBLIC_KEY.substring(0, 10) + '... (length: ' + CLOVER_PUBLIC_KEY.length + ')' : 'MISSING',
      CLOVER_MERCHANT_ID: CLOVER_MERCHANT_ID || 'MISSING',
      publicKeyConfigured: !!CLOVER_PUBLIC_KEY,
      merchantIdConfigured: !!CLOVER_MERCHANT_ID,
    }, null, 2));

    // Prevent double initialization
    if (initializedRef.current) {
      console.log('[PAYMENT FORM] Already initialized, skipping...');
      return;
    }

    // Set up message handler for Clover iframe communication
    const handleCloverMessage = (event) => {
      // Verify message is from Clover domain
      const cloverOrigin = CLOVER_ENVIRONMENT === 'production'
        ? 'https://checkout.clover.com'
        : 'https://checkout.sandbox.dev.clover.com';
      
      if (event.origin !== cloverOrigin) {
        return;
      }

      // Handle Clover messages (like inline-menu-ready)
      if (event.data && typeof event.data === 'object') {
        // Silently handle Clover internal messages
        // These are typically initialization messages that don't require action
        if (event.data.type === 'inline-menu-ready' || event.data.event === 'inline-menu-ready') {
          // Message received, no action needed
          return;
        }
      }
    };

    // Register message handler early, before SDK loads
    if (typeof window !== 'undefined') {
      console.log('[PAYMENT FORM] Registering Clover message handler');
      window.addEventListener('message', handleCloverMessage);
    }

    const initialize = async () => {
      console.log('[PAYMENT FORM] Starting SDK initialization...');
      // Load Clover SDK script if not already loaded
      if (typeof window !== 'undefined' && !window.Clover && !scriptLoadedRef.current) {
        console.log('[PAYMENT FORM] Loading Clover SDK script from:', CLOVER_SDK_URL);
        scriptLoadedRef.current = true;
        const script = document.createElement('script');
        script.src = CLOVER_SDK_URL;
        script.async = true;
        script.id = 'clover-sdk-script';
        script.onload = () => {
          console.log('[PAYMENT FORM] ✅ Clover SDK script loaded successfully');
          // Small delay to ensure DOM is ready
          setTimeout(() => {
            initializeClover();
          }, 100);
        };
        script.onerror = () => {
          console.error('[PAYMENT FORM] ❌ Failed to load Clover SDK script');
          setError('Failed to load Clover payment system. Please refresh the page.');
        };
        document.body.appendChild(script);
      } else if (window.Clover) {
        console.log('[PAYMENT FORM] Clover SDK already loaded, initializing...');
        // SDK already loaded, initialize after a brief delay
        setTimeout(() => {
          initializeClover();
        }, 100);
      } else {
        console.warn('[PAYMENT FORM] ⚠️  Window object not available');
      }
    };

    initialize();

    return () => {
      // Remove message handler
      if (typeof window !== 'undefined') {
        window.removeEventListener('message', handleCloverMessage);
      }

      // Cleanup Clover elements
      if (cardNumberRef.current) {
        try {
          cardNumberRef.current.unmount();
          cardNumberRef.current = null;
        } catch (e) {
          console.warn('Error unmounting card number:', e);
        }
      }
      if (cardExpiryRef.current) {
        try {
          cardExpiryRef.current.unmount();
          cardExpiryRef.current = null;
        } catch (e) {
          console.warn('Error unmounting card expiry:', e);
        }
      }
      if (cardCvvRef.current) {
        try {
          cardCvvRef.current.unmount();
          cardCvvRef.current = null;
        } catch (e) {
          console.warn('Error unmounting card CVV:', e);
        }
      }
      initializedRef.current = false;
    };
  }, []);

  const initializeClover = () => {
    console.log('[PAYMENT FORM] ========== INITIALIZING CLOVER SDK ==========');
    console.log('[PAYMENT FORM] Checking prerequisites...');
    
    // Prevent double initialization
    if (initializedRef.current || !window.Clover || !CLOVER_PUBLIC_KEY) {
      console.log('[PAYMENT FORM] Initialization check:', JSON.stringify({
        alreadyInitialized: initializedRef.current,
        hasWindowClover: !!window.Clover,
        hasPublicKey: !!CLOVER_PUBLIC_KEY,
      }, null, 2));
      if (!CLOVER_PUBLIC_KEY) {
        console.error('[PAYMENT FORM] ❌ Missing CLOVER_PUBLIC_KEY');
        setError('Clover payment system not properly configured. Please contact support.');
      }
      return;
    }

    console.log('[PAYMENT FORM] ✅ Prerequisites met, checking DOM elements...');
    // Check if DOM elements exist and don't already have Clover iframes
    const cardNumberEl = document.getElementById('clover-card-number');
    const cardExpiryEl = document.getElementById('clover-card-expiry');
    const cardCvvEl = document.getElementById('clover-card-cvv');

    console.log('[PAYMENT FORM] DOM elements:', JSON.stringify({
      cardNumber: !!cardNumberEl,
      cardExpiry: !!cardExpiryEl,
      cardCvv: !!cardCvvEl,
    }, null, 2));

    if (!cardNumberEl || !cardExpiryEl || !cardCvvEl) {
      console.log('[PAYMENT FORM] ⏳ DOM elements not ready, retrying in 100ms...');
      // Elements not ready yet, retry
      setTimeout(() => initializeClover(), 100);
      return;
    }

    // Check if elements already have Clover iframes mounted
    if (cardNumberEl.querySelector('iframe') || cardExpiryEl.querySelector('iframe') || cardCvvEl.querySelector('iframe')) {
      console.log('[PAYMENT FORM] ✅ Iframes already mounted, marking as ready');
      // Already mounted, just mark as ready
      setSdkReady(true);
      initializedRef.current = true;
      return;
    }

    try {
      console.log('[PAYMENT FORM] Creating Clover instance with public key...');
      console.log('[PAYMENT FORM] Public key being used:', CLOVER_PUBLIC_KEY ? CLOVER_PUBLIC_KEY.substring(0, 10) + '... (length: ' + CLOVER_PUBLIC_KEY.length + ')' : 'MISSING');
      // Initialize Clover with public key (PAKMS key) - only once
      if (!cloverRef.current) {
        try {
          console.log('[PAYMENT FORM] Calling new window.Clover() with public key...');
          cloverRef.current = new window.Clover(CLOVER_PUBLIC_KEY);
          console.log('[PAYMENT FORM] ✅ Clover instance created successfully');
          console.log('[PAYMENT FORM] Clover instance type:', typeof cloverRef.current);
          console.log('[PAYMENT FORM] Clover instance has elements method:', typeof cloverRef.current?.elements === 'function');
          console.log('[PAYMENT FORM] Clover instance has createToken method:', typeof cloverRef.current?.createToken === 'function');
        } catch (cloverInitError) {
          console.error('[PAYMENT FORM] ❌ ERROR creating Clover instance:', cloverInitError);
          console.error('[PAYMENT FORM] Error details:', JSON.stringify({
            message: cloverInitError.message,
            stack: cloverInitError.stack,
            name: cloverInitError.name,
          }, null, 2));
          throw cloverInitError;
        }
      } else {
        console.log('[PAYMENT FORM] Clover instance already exists');
      }
      
      console.log('[PAYMENT FORM] Getting Clover elements...');
      const elements = cloverRef.current.elements();
      console.log('[PAYMENT FORM] ✅ Elements retrieved');

      // Define custom styles for Clover iframe elements
      const cloverStyles = {
        base: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          fontSize: '16px',
          color: '#1f2937',
          '::placeholder': {
            color: '#9ca3af',
            fontSize: '16px',
          },
        },
        invalid: {
          color: '#ef4444',
        },
        input: {
          fontSize: '16px',
          lineHeight: '1.5',
          padding: '0.75rem 1rem',
        },
      };

      console.log('[PAYMENT FORM] Mounting Clover iframes...');
      // Create and mount card number element (only if not already mounted)
      if (!cardNumberRef.current && cardNumberEl && !cardNumberEl.querySelector('iframe')) {
        console.log('[PAYMENT FORM] Mounting CARD_NUMBER iframe...');
        cardNumberRef.current = elements.create('CARD_NUMBER', cloverStyles);
        cardNumberRef.current.mount('#clover-card-number');
        console.log('[PAYMENT FORM] ✅ CARD_NUMBER iframe mounted');
      }

      // Create and mount card expiry element (only if not already mounted)
      if (!cardExpiryRef.current && cardExpiryEl && !cardExpiryEl.querySelector('iframe')) {
        console.log('[PAYMENT FORM] Mounting CARD_DATE iframe...');
        cardExpiryRef.current = elements.create('CARD_DATE', cloverStyles);
        cardExpiryRef.current.mount('#clover-card-expiry');
        console.log('[PAYMENT FORM] ✅ CARD_DATE iframe mounted');
      }

      // Create and mount card CVV element (only if not already mounted)
      if (!cardCvvRef.current && cardCvvEl && !cardCvvEl.querySelector('iframe')) {
        console.log('[PAYMENT FORM] Mounting CARD_CVV iframe...');
        cardCvvRef.current = elements.create('CARD_CVV', cloverStyles);
        cardCvvRef.current.mount('#clover-card-cvv');
        console.log('[PAYMENT FORM] ✅ CARD_CVV iframe mounted');
      }

      console.log('[PAYMENT FORM] ✅ All iframes mounted successfully');
      console.log('[PAYMENT FORM] Marking SDK as ready...');
      setSdkReady(true);
      initializedRef.current = true;
      console.log('[PAYMENT FORM] ========== CLOVER SDK INITIALIZED ==========');
      console.log('═══════════════════════════════════════════════════════════');
    } catch (err) {
      console.error('[PAYMENT FORM] ❌ Clover initialization error:', err);
      console.error('[PAYMENT FORM] Error details:', JSON.stringify({
        message: err.message,
        stack: err.stack,
        name: err.name,
      }, null, 2));
      setError('Failed to initialize payment system. Please refresh the page.');
    }
  };

  const handlePayment = async (token) => {
    console.log('[PAYMENT FORM] Step 4: Processing payment with token');
    console.log('[PAYMENT FORM] Token received:', JSON.stringify({
      exists: !!token,
      length: token?.length || 0,
      prefix: token ? token.substring(0, 30) + '...' : 'MISSING',
    }, null, 2));

    if (!token) {
      console.error('[PAYMENT FORM] ❌ Step 4 FAILED: Invalid payment token');
      setError('Invalid payment token');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const paymentPayload = {
      amount: amount,
      source: token,
      currency: 'USD',
    };

    console.log('[PAYMENT FORM] Step 5: Sending payment request to backend');
    console.log('[PAYMENT FORM] Request URL: /api/payments/process');
    console.log('[PAYMENT FORM] Request Method: POST');
    console.log('[PAYMENT FORM] Request Payload:', JSON.stringify({
      amount: paymentPayload.amount,
      amountInDollars: paymentPayload.amount,
      source: paymentPayload.source.substring(0, 30) + '... (length: ' + paymentPayload.source.length + ')',
      currency: paymentPayload.currency,
    }, null, 2));
    console.log('[PAYMENT FORM] Full payload:', JSON.stringify(paymentPayload, null, 2));

    try {
      const requestStartTime = Date.now();
      // Process payment through backend
      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentPayload),
      });
      const requestDuration = Date.now() - requestStartTime;

      console.log('[PAYMENT FORM] Step 6: Backend response received');
      console.log('[PAYMENT FORM] Response duration:', requestDuration, 'ms');
      console.log('[PAYMENT FORM] Response status:', response.status, response.statusText);
      console.log('[PAYMENT FORM] Response OK:', response.ok);
      console.log('[PAYMENT FORM] Response headers:', JSON.stringify({
        'content-type': response.headers.get('content-type'),
      }, null, 2));

      const result = await response.json();
      console.log('[PAYMENT FORM] Response body:', JSON.stringify(result, null, 2));

      if (!response.ok) {
        console.error('[PAYMENT FORM] ❌ Step 6 FAILED: Backend returned error');
        console.error('[PAYMENT FORM] Error response:', JSON.stringify(result, null, 2));
        throw new Error(result.error || 'Payment processing failed');
      }

      console.log('[PAYMENT FORM] ✅ Step 6 SUCCESS: Payment processed');
      console.log('[PAYMENT FORM] Payment result:', JSON.stringify({
        success: result.data?.success,
        chargeId: result.data?.chargeId,
        status: result.data?.status,
        amount: result.data?.amount,
        currency: result.data?.currency,
      }, null, 2));
      console.log('[PAYMENT FORM] ========== PAYMENT FLOW END (SUCCESS) ==========');
      console.log('═══════════════════════════════════════════════════════════');

      // Payment successful
      if (onPaymentSuccess) {
        onPaymentSuccess(result.data);
      }
    } catch (err) {
      console.error('[PAYMENT FORM] ❌ Step 6 ERROR:', err.message);
      console.error('[PAYMENT FORM] Error details:', JSON.stringify({
        message: err.message,
        stack: err.stack,
        name: err.name,
      }, null, 2));
      console.error('[PAYMENT FORM] ========== PAYMENT FLOW END (ERROR) ==========');
      console.log('═══════════════════════════════════════════════════════════');
      setError(err.message || 'Payment processing failed. Please try again.');
      setLoading(false);
      if (onPaymentError) {
        onPaymentError(err.message || 'Payment processing failed');
      }
    }
  };

  const handleSubmit = async () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('[PAYMENT FORM] ========== PAYMENT FLOW START ==========');
    console.log('[PAYMENT FORM] Step 1: User clicked submit button');
    console.log('[PAYMENT FORM] ⚠️  DEBUG: handleSubmit function called at:', new Date().toISOString());
    console.log('[PAYMENT FORM] Form state check:', JSON.stringify({
      disabled,
      loading,
      sdkReady,
      hasCloverRef: !!cloverRef.current,
      amount: amount,
    }, null, 2));

    if (disabled || loading || !sdkReady || !cloverRef.current) {
      console.warn('[PAYMENT FORM] ❌ Submit blocked - form not ready');
      return;
    }

    // Log environment configuration
    console.log('[PAYMENT FORM] Environment Configuration:', JSON.stringify({
      environment: CLOVER_ENVIRONMENT,
      sdkUrl: CLOVER_SDK_URL,
      publicKeyConfigured: !!CLOVER_PUBLIC_KEY,
      publicKeyPrefix: CLOVER_PUBLIC_KEY ? CLOVER_PUBLIC_KEY.substring(0, 10) + '...' : 'MISSING',
      merchantIdConfigured: !!CLOVER_MERCHANT_ID,
      merchantId: CLOVER_MERCHANT_ID || 'MISSING',
    }, null, 2));

    setError(null);
    setLoading(true);

    try {
      console.log('[PAYMENT FORM] Step 2: Preparing to call Clover SDK createToken()');
      console.log('[PAYMENT FORM] SDK instance:', JSON.stringify({
        exists: !!cloverRef.current,
        hasCreateToken: typeof cloverRef.current?.createToken === 'function',
      }, null, 2));

      // Check if iframe elements exist and are ready
      const cardNumberEl = document.getElementById('clover-card-number');
      const cardExpiryEl = document.getElementById('clover-card-expiry');
      const cardCvvEl = document.getElementById('clover-card-cvv');
      
      console.log('[PAYMENT FORM] Checking iframe elements before createToken:', JSON.stringify({
        cardNumberExists: !!cardNumberEl,
        cardExpiryExists: !!cardExpiryEl,
        cardCvvExists: !!cardCvvEl,
        cardNumberHasIframe: cardNumberEl?.querySelector('iframe') ? true : false,
        cardExpiryHasIframe: cardExpiryEl?.querySelector('iframe') ? true : false,
        cardCvvHasIframe: cardCvvEl?.querySelector('iframe') ? true : false,
      }, null, 2));

      // Check if Clover SDK is properly initialized
      console.log('[PAYMENT FORM] Clover SDK state:', JSON.stringify({
        windowCloverExists: typeof window !== 'undefined' && !!window.Clover,
        cloverInstanceExists: !!cloverRef.current,
        elementsMethodExists: typeof cloverRef.current?.elements === 'function',
        createTokenMethodExists: typeof cloverRef.current?.createToken === 'function',
      }, null, 2));

      // Verify the createToken method signature
      console.log('[PAYMENT FORM] Step 2.5: Verifying createToken method...');
      const createTokenFn = cloverRef.current.createToken;
      console.log('[PAYMENT FORM] createToken function details:', JSON.stringify({
        isFunction: typeof createTokenFn === 'function',
        functionName: createTokenFn?.name || 'anonymous',
        functionLength: createTokenFn?.length || 0, // Number of parameters
      }, null, 2));

      // Try to inspect what createToken expects
      console.log('[PAYMENT FORM] Attempting to call createToken()...');
      console.log('[PAYMENT FORM] ⚠️  If this hangs, possible causes:');
      console.log('[PAYMENT FORM]   1. Public key mismatch (production key in sandbox)');
      console.log('[PAYMENT FORM]   2. SDK not fully initialized');
      console.log('[PAYMENT FORM]   3. Iframes not ready or card data not entered');
      console.log('[PAYMENT FORM]   4. Network/CORS blocking requests to Clover');

      const tokenStartTime = Date.now();
      console.log('[PAYMENT FORM] ⏱️  Token creation started at:', new Date().toISOString());
      
      // Create payment token from Clover with timeout
      // Note: createToken() expects 1 parameter (options object), but can be called with empty object
      let createTokenPromise;
      try {
        console.log('[PAYMENT FORM] Calling cloverRef.current.createToken()...');
        console.log('[PAYMENT FORM] ⚠️  CRITICAL: If this hangs, the public key may be invalid for sandbox');
        console.log('[PAYMENT FORM] Public key being used:', CLOVER_PUBLIC_KEY);
        console.log('[PAYMENT FORM] Merchant ID:', CLOVER_MERCHANT_ID);
        console.log('[PAYMENT FORM] Environment:', CLOVER_ENVIRONMENT);
        console.log('[PAYMENT FORM] ⚠️  VERIFY: Your public key must match the sandbox environment!');
        console.log('[PAYMENT FORM] ⚠️  If you have a production key, it will NOT work in sandbox!');
        
        // Verify messageElement exists (required for createToken to work)
        console.log('[PAYMENT FORM] Checking messageElement:', JSON.stringify({
          hasMessageElement: !!cloverRef.current?.messageElement,
          messageElementMounted: !!cloverRef.current?.messageElement?.mountedIFrame,
          iframeSrc: cloverRef.current?.messageElement?.mountedIFrame?.src || 'N/A',
          iframeContentWindow: !!cloverRef.current?.messageElement?.mountedIFrame?.contentWindow,
        }, null, 2));
        
        if (!cloverRef.current?.messageElement) {
          console.error('[PAYMENT FORM] ❌ ERROR: messageElement is not initialized!');
          console.error('[PAYMENT FORM] This means elements() was never called or failed.');
          throw new Error('Clover SDK not properly initialized. Please refresh the page.');
        }
        
        // Check if the iframe is actually loaded and ready
        const messageIframe = cloverRef.current?.messageElement?.mountedIFrame;
        if (messageIframe) {
          console.log('[PAYMENT FORM] Checking iframe readiness:', JSON.stringify({
            iframeExists: !!messageIframe,
            iframeSrc: messageIframe.src,
            iframeComplete: messageIframe.complete,
            hasContentWindow: !!messageIframe.contentWindow,
            iframeReadyState: messageIframe.readyState || 'N/A',
          }, null, 2));
          
          // Wait for iframe to be fully loaded
          if (!messageIframe.contentWindow) {
            console.warn('[PAYMENT FORM] ⚠️  Iframe contentWindow not available yet, waiting...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Wait for iframe to fully load
          if (messageIframe.contentWindow) {
            console.log('[PAYMENT FORM] Waiting for iframe to fully load...');
            await new Promise((resolve) => {
              const checkLoad = () => {
                try {
                  // Try to access iframe content to verify it's loaded
                  if (messageIframe.contentWindow && messageIframe.contentWindow.document) {
                    console.log('[PAYMENT FORM] ✅ Iframe appears to be loaded');
                    resolve();
                  } else {
                    setTimeout(checkLoad, 100);
                  }
                } catch (e) {
                  // Cross-origin iframe - can't access content, but that's expected
                  console.log('[PAYMENT FORM] ✅ Iframe is cross-origin (expected), assuming loaded');
                  resolve();
                }
              };
              messageIframe.onload = () => {
                console.log('[PAYMENT FORM] ✅ Iframe onload event fired');
                resolve();
              };
              // Timeout after 3 seconds
              setTimeout(() => {
                console.warn('[PAYMENT FORM] ⚠️  Iframe load timeout, proceeding anyway...');
                resolve();
              }, 3000);
              checkLoad();
            });
          }
        }
        
        // Set up message listener to debug postMessage communication
        console.log('[PAYMENT FORM] Setting up postMessage listener to debug iframe communication...');
        const messageListener = (event) => {
          // Only log messages from Clover domain
          if (event.origin.includes('clover.com')) {
            let parsedData = event.data;
            try {
              if (typeof event.data === 'string') {
                parsedData = JSON.parse(event.data);
              }
            } catch (e) {
              // Not JSON, keep as is
            }
            
            console.log('[PAYMENT FORM] 📨 Received postMessage from Clover:', JSON.stringify({
              origin: event.origin,
              functionToInvoke: parsedData?.functionToInvoke || 'N/A',
              hash: parsedData?.hash || 'N/A',
              sender: parsedData?.sender || 'N/A',
              recipients: parsedData?.recipients || 'N/A',
              shouldDefer: parsedData?.shouldDefer || false,
              hasData: !!parsedData?.data,
              dataKeys: parsedData?.data ? Object.keys(parsedData.data) : [],
              fullData: parsedData,
            }, null, 2));
            
            // Check if this is a token response
            if (parsedData?.functionToInvoke === 'onTokenReceived' || parsedData?.data?.token) {
              console.log('[PAYMENT FORM] ✅ TOKEN RESPONSE DETECTED!');
            }
            
            // Check if this is an error response
            if (parsedData?.functionToInvoke?.includes('Error') || parsedData?.data?.error) {
              console.error('[PAYMENT FORM] ❌ ERROR RESPONSE DETECTED!');
            }
          }
        };
        window.addEventListener('message', messageListener);
        
        // Clean up listener after timeout
        setTimeout(() => {
          window.removeEventListener('message', messageListener);
          console.log('[PAYMENT FORM] Removed postMessage listener');
        }, 35000);
        
        // According to Clover SDK source, createToken accepts a boolean (isMultipayToken)
        // Default is false. We'll call it without parameters (uses default false)
        console.log('[PAYMENT FORM] Calling createToken() with default parameters (isMultipayToken=false)...');
        console.log('[PAYMENT FORM] ⚠️  IMPORTANT: Make sure card data is entered in all fields before clicking!');
        createTokenPromise = cloverRef.current.createToken();
        console.log('[PAYMENT FORM] createToken() returned:', createTokenPromise);
        console.log('[PAYMENT FORM] createToken() is a promise:', createTokenPromise instanceof Promise);
        console.log('[PAYMENT FORM] createToken() type:', typeof createTokenPromise);
        
        // CRITICAL: If createToken returns undefined, it means messageElement.onSubmit failed
        if (!createTokenPromise) {
          console.error('[PAYMENT FORM] ❌ CRITICAL ERROR: createToken() returned undefined!');
          console.error('[PAYMENT FORM] This means messageElement.onSubmit() failed or messageElement is not properly initialized.');
          throw new Error('Failed to create payment token. The Clover SDK may not be properly initialized.');
        }
        
        if (!(createTokenPromise instanceof Promise)) {
          console.error('[PAYMENT FORM] ❌ CRITICAL ERROR: createToken() did not return a Promise!');
          console.error('[PAYMENT FORM] Returned value:', createTokenPromise);
          throw new Error('createToken() did not return a valid promise. SDK may be misconfigured.');
        }
        
        // Add promise handlers to catch any immediate rejections
        createTokenPromise.catch((immediateError) => {
          console.error('[PAYMENT FORM] ❌ IMMEDIATE REJECTION from createToken():', immediateError);
        });
      } catch (syncError) {
        console.error('[PAYMENT FORM] ❌ SYNCHRONOUS ERROR in createToken():', syncError);
        console.error('[PAYMENT FORM] Error details:', JSON.stringify({
          message: syncError.message,
          stack: syncError.stack,
          name: syncError.name,
        }, null, 2));
        throw syncError;
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.error('[PAYMENT FORM] ⏱️  TIMEOUT: 30 seconds elapsed, createToken() never resolved');
          reject(new Error('Payment processing is taking longer than expected. Please check your card information and try again.'));
        }, 30000); // 30 second timeout
      });
      
      console.log('[PAYMENT FORM] Waiting for createToken() promise to resolve...');
      console.log('[PAYMENT FORM] This should make a network request to Clover. Check Network tab now!');
      
      const result = await Promise.race([createTokenPromise, timeoutPromise]);
      const tokenDuration = Date.now() - tokenStartTime;
      console.log('[PAYMENT FORM] ✅ createToken() resolved after', tokenDuration, 'ms');

      console.log('[PAYMENT FORM] Step 3: Token creation response received');
      console.log('[PAYMENT FORM] Token creation duration:', tokenDuration, 'ms');
      console.log('[PAYMENT FORM] Token result:', JSON.stringify({
        hasToken: !!result.token,
        tokenLength: result.token?.length || 0,
        tokenPrefix: result.token ? result.token.substring(0, 20) + '...' : 'N/A',
        hasErrors: !!result.errors,
        errorCount: result.errors?.length || 0,
        fullResult: result,
      }, null, 2));

      if (result.errors) {
        console.error('[PAYMENT FORM] ❌ Step 3 FAILED: Validation errors from Clover SDK');
        console.error('[PAYMENT FORM] Validation errors:', JSON.stringify(result.errors, null, 2));
        // Handle validation errors
        const errorMessages = result.errors.map(err => err.message).join(', ');
        setError(errorMessages);
        setLoading(false);
        if (onPaymentError) {
          onPaymentError(errorMessages);
        }
        console.log('[PAYMENT FORM] ========== PAYMENT FLOW END (VALIDATION ERROR) ==========');
        console.log('═══════════════════════════════════════════════════════════');
        return;
      }

      if (result.token) {
        console.log('[PAYMENT FORM] ✅ Step 3 SUCCESS: Token created');
        console.log('[PAYMENT FORM] Token value (first 30 chars):', result.token.substring(0, 30) + '...');
        // Token created successfully, process payment
        await handlePayment(result.token);
      } else {
        console.error('[PAYMENT FORM] ❌ Step 3 FAILED: No token in result');
        console.error('[PAYMENT FORM] Full result object:', JSON.stringify(result, null, 2));
        throw new Error('Failed to create payment token');
      }
    } catch (err) {
      console.error('[PAYMENT FORM] ❌ PAYMENT SUBMISSION ERROR:', err.message);
      console.error('[PAYMENT FORM] Error stack:', err.stack);
      console.error('[PAYMENT FORM] ========== PAYMENT FLOW END (ERROR) ==========');
      console.log('═══════════════════════════════════════════════════════════');
      setError(err.message || 'Failed to process payment');
      setLoading(false);
      if (onPaymentError) {
        onPaymentError(err.message || 'Failed to process payment');
      }
    }
  };

  if (!CLOVER_PUBLIC_KEY || !CLOVER_MERCHANT_ID) {
    return (
      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <svg className="h-6 w-6 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-red-700">
            Payment system not configured. Please contact support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center pb-2">
          <h3 className="text-xl font-bold text-[var(--coffee-brown)] mb-1">Secure Payment</h3>
          <p className="text-sm text-gray-600">Enter your payment details below</p>
        </div>

        {/* Payment form fields */}
        <div className="space-y-5">
          {/* Card Number */}
          <div>
            <label className="mb-2.5 block text-sm font-semibold text-[var(--coffee-brown)]">
              Card Number
            </label>
            <div
              id="clover-card-number"
              className="relative h-12 rounded-xl border-2 border-gray-200 bg-white px-4 py-2 transition-all focus-within:border-[var(--lime-green)] focus-within:ring-2 focus-within:ring-[var(--lime-green)] focus-within:ring-opacity-20 shadow-sm overflow-hidden"
              style={{ lineHeight: '1.5' }}
            />
          </div>

          {/* Expiry and CVV */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2.5 block text-sm font-semibold text-[var(--coffee-brown)]">
                Expiry Date
              </label>
              <div
                id="clover-card-expiry"
                className="relative h-12 rounded-xl border-2 border-gray-200 bg-white px-4 py-2 transition-all focus-within:border-[var(--lime-green)] focus-within:ring-2 focus-within:ring-[var(--lime-green)] focus-within:ring-opacity-20 shadow-sm overflow-hidden"
                style={{ lineHeight: '1.5' }}
              />
            </div>

            <div>
              <label className="mb-2.5 block text-sm font-semibold text-[var(--coffee-brown)]">
                CVV
              </label>
              <div
                id="clover-card-cvv"
                className="relative h-12 rounded-xl border-2 border-gray-200 bg-white px-4 py-2 transition-all focus-within:border-[var(--lime-green)] focus-within:ring-2 focus-within:ring-[var(--lime-green)] focus-within:ring-opacity-20 shadow-sm overflow-hidden"
                style={{ lineHeight: '1.5' }}
              />
            </div>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border-2 border-red-200 bg-red-50 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Payment summary */}
        <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-[var(--coffee-brown)]">Total Amount</span>
            <span className="text-2xl font-bold text-[var(--coffee-brown)]">
              ${amount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="button"
          onClick={(e) => {
            console.log('[PAYMENT FORM] 🔘 BUTTON CLICKED - onClick handler fired');
            console.log('[PAYMENT FORM] Button state:', JSON.stringify({
              disabled,
              loading,
              sdkReady,
              buttonDisabled: disabled || loading || !sdkReady,
            }, null, 2));
            if (disabled || loading || !sdkReady) {
              console.warn('[PAYMENT FORM] ⚠️  Button click ignored - button is disabled');
              return;
            }
            console.log('[PAYMENT FORM] ✅ Button click proceeding to handleSubmit');
            handleSubmit();
          }}
          disabled={disabled || loading || !sdkReady}
          className="w-full rounded-xl bg-gradient-to-r from-[var(--lime-green)] to-[var(--lime-green-dark)] px-6 py-4 text-white font-bold text-lg shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-3">
              <svg
                className="h-5 w-5 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Processing Payment...</span>
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Complete Payment
            </span>
          )}
        </button>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-xs text-gray-500">
            Your payment information is securely processed by Clover
          </p>
        </div>
      </div>
    </motion.div>
  );
}

