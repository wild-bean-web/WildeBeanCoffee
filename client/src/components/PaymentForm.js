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
    // Prevent double initialization
    if (initializedRef.current) {
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
      window.addEventListener('message', handleCloverMessage);
    }

    const initialize = async () => {
      // Load Clover SDK script if not already loaded
      if (typeof window !== 'undefined' && !window.Clover && !scriptLoadedRef.current) {
        scriptLoadedRef.current = true;
        const script = document.createElement('script');
        script.src = CLOVER_SDK_URL;
        script.async = true;
        script.id = 'clover-sdk-script';
        script.onload = () => {
          // Small delay to ensure DOM is ready
          setTimeout(() => {
            initializeClover();
          }, 100);
        };
        script.onerror = () => {
          setError('Failed to load Clover payment system. Please refresh the page.');
        };
        document.body.appendChild(script);
      } else if (window.Clover) {
        // SDK already loaded, initialize after a brief delay
        setTimeout(() => {
          initializeClover();
        }, 100);
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
    // Prevent double initialization
    if (initializedRef.current || !window.Clover || !CLOVER_PUBLIC_KEY) {
      if (!CLOVER_PUBLIC_KEY) {
        setError('Clover payment system not properly configured. Please contact support.');
      }
      return;
    }

    // Check if DOM elements exist and don't already have Clover iframes
    const cardNumberEl = document.getElementById('clover-card-number');
    const cardExpiryEl = document.getElementById('clover-card-expiry');
    const cardCvvEl = document.getElementById('clover-card-cvv');

    if (!cardNumberEl || !cardExpiryEl || !cardCvvEl) {
      // Elements not ready yet, retry
      setTimeout(() => initializeClover(), 100);
      return;
    }

    // Check if elements already have Clover iframes mounted
    if (cardNumberEl.querySelector('iframe') || cardExpiryEl.querySelector('iframe') || cardCvvEl.querySelector('iframe')) {
      // Already mounted, just mark as ready
      setSdkReady(true);
      initializedRef.current = true;
      return;
    }

    try {
      // Initialize Clover with public key (PAKMS key) - only once
      if (!cloverRef.current) {
        cloverRef.current = new window.Clover(CLOVER_PUBLIC_KEY);
      }
      
      const elements = cloverRef.current.elements();

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

      // Create and mount card number element (only if not already mounted)
      if (!cardNumberRef.current && cardNumberEl && !cardNumberEl.querySelector('iframe')) {
        cardNumberRef.current = elements.create('CARD_NUMBER', cloverStyles);
        cardNumberRef.current.mount('#clover-card-number');
      }

      // Create and mount card expiry element (only if not already mounted)
      if (!cardExpiryRef.current && cardExpiryEl && !cardExpiryEl.querySelector('iframe')) {
        cardExpiryRef.current = elements.create('CARD_DATE', cloverStyles);
        cardExpiryRef.current.mount('#clover-card-expiry');
      }

      // Create and mount card CVV element (only if not already mounted)
      if (!cardCvvRef.current && cardCvvEl && !cardCvvEl.querySelector('iframe')) {
        cardCvvRef.current = elements.create('CARD_CVV', cloverStyles);
        cardCvvRef.current.mount('#clover-card-cvv');
      }

      setSdkReady(true);
      initializedRef.current = true;
    } catch (err) {
      console.error('Clover initialization error:', err);
      setError('Failed to initialize payment system. Please refresh the page.');
    }
  };

  const handlePayment = async (token) => {
    if (!token) {
      setError('Invalid payment token');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Process payment through backend
      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount,
          source: token,
          currency: 'USD',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Payment processing failed');
      }

      // Payment successful
      if (onPaymentSuccess) {
        onPaymentSuccess(result.data);
      }
    } catch (err) {
      console.error('Payment processing error:', err);
      setError(err.message || 'Payment processing failed. Please try again.');
      setLoading(false);
      if (onPaymentError) {
        onPaymentError(err.message || 'Payment processing failed');
      }
    }
  };

  const handleSubmit = async () => {
    if (disabled || loading || !sdkReady || !cloverRef.current) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Create payment token from Clover
      const result = await cloverRef.current.createToken();

      if (result.errors) {
        // Handle validation errors
        const errorMessages = result.errors.map(err => err.message).join(', ');
        setError(errorMessages);
        setLoading(false);
        if (onPaymentError) {
          onPaymentError(errorMessages);
        }
        return;
      }

      if (result.token) {
        // Token created successfully, process payment
        await handlePayment(result.token);
      } else {
        throw new Error('Failed to create payment token');
      }
    } catch (err) {
      console.error('Payment submission error:', err);
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
          onClick={handleSubmit}
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

