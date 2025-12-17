"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { locationApi, ordersApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import Lottie from "lottie-react";
import PaymentForm from "@/components/PaymentForm";

export default function OrderPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Customer information
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [validationErrors, setValidationErrors] = useState({});

  // Order details
  const [pickupTime, setPickupTime] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [storeHours, setStoreHours] = useState({ open: 6, close: 19 }); // Default fallback (6am-7pm)
  const [successAnimation, setSuccessAnimation] = useState(null);

  // Tax rate (8.75% - adjust as needed)
  const taxRate = 0.0875;

  useEffect(() => {
    // Load cart from localStorage or state
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }

    // Fetch store hours from API (single source of truth)
    const fetchStoreHours = async () => {
      try {
        const location = await locationApi.getLocation();
        if (location?.hours && location.hours.length > 0) {
          // Get hours for today (or use first day as default)
          const today = new Date();
          const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
          const todayHours = location.hours.find((h) => h.day === dayName) || location.hours[0];
          
          if (todayHours && !todayHours.closed) {
            // Parse opening and closing times (format: "HH:mm")
            const openTime = todayHours.opens?.split(":") || ["07", "00"];
            const closeTime = todayHours.closes?.split(":") || ["20", "00"];
            
            setStoreHours({
              open: parseInt(openTime[0], 10),
              close: parseInt(closeTime[0], 10),
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch store hours:", err);
        // Keep default fallback values
      }
    };

    fetchStoreHours();

    // Load SuccessToast animation
    fetch("/animations/SuccessToast.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        try {
          const data = JSON.parse(text);
          setSuccessAnimation(data);
        } catch (parseError) {
          console.error("Failed to parse SuccessToast Lottie JSON:", parseError);
        }
      })
      .catch((err) => console.error("Failed to load SuccessToast Lottie animation:", err));
  }, []);

  // Pre-fill customer info when user is signed in
  useEffect(() => {
    if (user && !authLoading) {
      setCustomerInfo({
        name: `${user.firstName} ${user.lastName}`,
        phone: user.phone || "",
        email: user.email || "",
      });
    }
  }, [user, authLoading]);

  // Calculate the first available time slot for today
  const getFirstAvailableTime = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Calculate current time + 15 minutes, rounded up to next 15-min increment
    let firstHour = currentHour;
    let firstMinute = Math.ceil((currentMinute + 15) / 15) * 15;

    // Handle minute overflow
    if (firstMinute >= 60) {
      firstHour += 1;
      firstMinute = 0;
    }

    // If before store open time + 15 minutes, start at store open time
    if (firstHour < storeHours.open || (firstHour === storeHours.open && firstMinute < 15)) {
      firstHour = storeHours.open;
      firstMinute = 0;
    }

    // If after store close time, no slots available for today
    if (firstHour >= storeHours.close) {
      return null;
    }

    return { hour: firstHour, minute: firstMinute };
  };

  // Generate time slots for a given date
  const getTimeSlotsForDate = (dateString) => {
    const slots = [];
    const isToday = isTodayDate(dateString);

    if (isToday) {
      const firstTime = getFirstAvailableTime();
      if (!firstTime) {
        return [];
      }

      let hour = firstTime.hour;
      let minute = firstTime.minute;

      while (hour < storeHours.close) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        const displayTime = formatTimeDisplay(hour, minute);
        slots.push({ value: timeString, display: displayTime });

        minute += 15;
        if (minute >= 60) {
          hour += 1;
          minute = 0;
        }
      }
    } else {
      // For future dates, start at store open time
      let hour = storeHours.open;
      let minute = 0;

      while (hour < storeHours.close) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        const displayTime = formatTimeDisplay(hour, minute);
        slots.push({ value: timeString, display: displayTime });

        minute += 15;
        if (minute >= 60) {
          hour += 1;
          minute = 0;
        }
      }
    }

    return slots;
  };

  // Format time for display (12-hour format with AM/PM)
  const formatTimeDisplay = (hour, minute) => {
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${hour12}:${minute.toString().padStart(2, "0")} ${ampm}`;
  };

  // Generate available dates (today + next 30 days)
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 31; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      // Format date string using local date components to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;
      const slots = getTimeSlotsForDate(dateString);
      
      // Only include dates that have available time slots
      if (slots.length > 0 || i > 0) {
        dates.push({
          value: dateString,
          display: formatDateDisplay(dateString, i === 0),
        });
      }
    }

    return dates;
  };

  // Parse date string in local time (avoid timezone issues)
  const parseLocalDate = (dateString) => {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  // Check if date string is today (using local date)
  const isTodayDate = (dateString) => {
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return dateString === todayString;
  };

  // Format date for display
  const formatDateDisplay = (dateString, isToday) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Parse date string in local time to avoid timezone issues
    const date = parseLocalDate(dateString);
    
    if (isToday) {
      return `Today, ${months[date.getMonth()]} ${date.getDate()}`;
    }
    
    const dayName = days[date.getDay()];
    return `${dayName}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  // Handle date selection
  const handleDateSelect = (dateString) => {
    setSelectedDate(dateString);
    setSelectedTime(""); // Reset time when date changes
    setPickupTime(""); // Reset pickup time
    setShowDatePicker(false);
    setShowTimePicker(false);
  };

  // Handle time selection
  const handleTimeSelect = (timeString) => {
    setSelectedTime(timeString);
    if (selectedDate) {
      // Combine date and time into ISO string
      const dateTimeString = `${selectedDate}T${timeString}:00`;
      setPickupTime(dateTimeString);
    }
    setShowTimePicker(false);
  };

  // Initialize selected date to today if available
  useEffect(() => {
    if (!selectedDate) {
      const dates = getAvailableDates();
      if (dates.length > 0) {
        setSelectedDate(dates[0].value);
      }
    }
  }, []);

  // Update pickupTime when both date and time are selected
  useEffect(() => {
    if (selectedDate && selectedTime) {
      const dateTimeString = `${selectedDate}T${selectedTime}:00`;
      setPickupTime(dateTimeString);
    }
  }, [selectedDate, selectedTime]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDatePicker || showTimePicker) {
        const target = event.target;
        if (!target.closest('[data-date-picker]') && !target.closest('[data-time-picker]')) {
          setShowDatePicker(false);
          setShowTimePicker(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker, showTimePicker]);

  const updateQuantity = (itemId, change) => {
    setCart((prevCart) => {
      const updated = prevCart.map((item) => {
        if (item._id === itemId) {
          const newQuantity = item.quantity + change;
          if (newQuantity <= 0) return null;
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(Boolean);

      localStorage.setItem("cart", JSON.stringify(updated));
      return updated;
    });
  };

  const removeItem = (itemId) => {
    setCart((prevCart) => {
      const updated = prevCart.filter((item) => item._id !== itemId);
      localStorage.setItem("cart", JSON.stringify(updated));
      return updated;
    });
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const formatPrice = (price, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(price);
  };

  // Validation functions
  const validatePhone = (phone) => {
    // Remove all non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, "");
    // Valid if it has 10 or more digits (allows country codes)
    return digitsOnly.length >= 10;
  };

  const validateEmail = (email) => {
    if (!email || email.trim() === "") return true; // Email is optional
    // Simple email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const errors = {};
    
    // Only validate customer info if user is not signed in
    if (!user) {
      if (!customerInfo.name.trim()) {
        errors.name = "Name is required";
      }
      
      if (!customerInfo.phone.trim()) {
        errors.phone = "Phone number is required";
      } else if (!validatePhone(customerInfo.phone)) {
        errors.phone = "Please enter a valid phone number (at least 10 digits)";
      }
      
      if (customerInfo.email && !validateEmail(customerInfo.email)) {
        errors.email = "Please enter a valid email address";
      }
    }

    // Validate pickup date and time
    if (!selectedDate) {
      errors.pickupDate = "Please select a pickup date";
    }
    
    if (!selectedTime) {
      errors.pickupTime = "Please select a pickup time";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOrderInfoSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Show payment form
    setShowPayment(true);
  };

  const handlePaymentSuccess = async (paymentResult) => {
    setPaymentData(paymentResult);
    setPaymentProcessing(true);
    setError(null);

    try {
      const { subtotal, tax, total } = calculateTotals();

      // Prepare order items
      const orderItems = cart.map((item) => ({
        itemType: item.itemType || "product", // 'product' or 'menu'
        itemId: item._id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      // Use user info if signed in, otherwise use form data
      const customerData = user
        ? {
            name: `${user.firstName} ${user.lastName}`,
            phone: user.phone,
            email: user.email || undefined,
          }
        : {
            ...customerInfo,
            email: customerInfo.email || undefined,
          };

      const orderData = {
        customer: customerData,
        items: orderItems,
        taxRate,
        pickupTime: pickupTime || undefined,
        notes: notes || undefined,
        paymentStatus: "paid", // Payment already processed
        paymentRef: paymentResult.paymentRef || paymentResult.chargeId,
      };

      setLoading(true);
      const result = await ordersApi.create(orderData);
      setOrderId(result._id);

      // Attempt to print receipt (non-blocking)
      try {
        await fetch('/api/payments/print-receipt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId: result._id,
          }),
        });
      } catch (printError) {
        console.error('Receipt printing failed:', printError);
        // Don't fail the order if printing fails
      }

      setOrderPlaced(true);
      
      // Clear cart
      localStorage.removeItem("cart");
      setCart([]);
    } catch (err) {
      setError(err.message || 'Failed to create order. Payment was successful, please contact support.');
      // Payment was successful but order creation failed - this is a critical error
      // In production, you might want to implement a refund or manual order creation process
    } finally {
      setLoading(false);
      setPaymentProcessing(false);
    }
  };

  const handlePaymentError = (errorMessage) => {
    setError(errorMessage || 'Payment processing failed. Please try again.');
    setPaymentProcessing(false);
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg bg-white p-8 text-center shadow-lg"
          >
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center">
                {successAnimation ? (
                  <Lottie
                    animationData={successAnimation}
                    loop={true}
                    autoplay={true}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--lime-green)]">
                    <svg
                      className="h-8 w-8 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <h2 className="mb-2 text-3xl font-bold text-[var(--coffee-brown)]">
                Order Placed Successfully!
              </h2>
              <p className="text-gray-600">
                Your order has been received and is being prepared.
              </p>
            </div>

            <div className="mb-6 rounded-lg bg-gray-50 p-4 text-left">
              <p className="mb-2 text-sm text-gray-600">Order ID:</p>
              <p className="font-mono text-lg font-semibold text-[var(--coffee-brown)]">
                {orderId}
              </p>
            </div>

            <div className="space-y-3">
              <Link
                href="/"
                className="block rounded-full bg-[var(--lime-green)] px-6 py-3 text-white font-semibold transition-colors hover:bg-[var(--lime-green-dark)]"
              >
                Return to Home
              </Link>
              <Link
                href="/menu"
                className="block rounded-full border-2 border-[var(--coffee-brown)] px-6 py-3 text-[var(--coffee-brown)] font-semibold transition-colors hover:bg-gray-50"
              >
                Browse Menu
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-4xl font-bold text-[var(--coffee-brown)]">
            Your Cart is Empty
          </h1>
          <p className="mb-8 text-lg text-gray-600">
            Add items from our shop or menu to get started.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/shop"
              className="rounded-full bg-[var(--lime-green)] px-6 py-3 text-white font-semibold transition-colors hover:bg-[var(--lime-green-dark)]"
            >
              Shop Coffee Beans
            </Link>
            <Link
              href="/menu"
              className="rounded-full border-2 border-[var(--coffee-brown)] px-6 py-3 text-[var(--coffee-brown)] font-semibold transition-colors hover:bg-gray-50"
            >
              View Menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { subtotal, tax, total } = calculateTotals();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-4xl font-bold text-[var(--coffee-brown)]">
          Checkout
        </h1>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Order Summary */}
          <div className="lg:col-span-2">
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-6 text-2xl font-semibold text-[var(--coffee-brown)]">
                Order Summary
              </h2>

              <div className="space-y-4">
                {cart.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between border-b border-gray-200 pb-4"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold text-[var(--coffee-brown)]">
                        {item.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {formatPrice(item.price, item.currency)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item._id, -1)}
                          className="rounded-full border border-gray-300 px-2 py-1 text-sm hover:bg-gray-100"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item._id, 1)}
                          className="rounded-full border border-gray-300 px-2 py-1 text-sm hover:bg-gray-100"
                        >
                          +
                        </button>
                      </div>
                      <div className="w-24 text-right">
                        <p className="font-semibold text-[var(--coffee-brown)]">
                          {formatPrice(
                            item.price * item.quantity,
                            item.currency
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item._id)}
                        className="text-red-600 hover:text-red-800"
                        aria-label="Remove item"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-gray-200 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">
                      {formatPrice(subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">{formatPrice(tax)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold">
                    <span className="text-[var(--coffee-brown)]">Total</span>
                    <span className="text-[var(--coffee-brown)]">
                      {formatPrice(total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="lg:col-span-1">
            <form
              onSubmit={handleOrderInfoSubmit}
              className="rounded-lg bg-white p-6 shadow-md"
            >
              <h2 className="mb-6 text-2xl font-semibold text-[var(--coffee-brown)]">
                {user ? "Order Details" : "Customer Information"}
              </h2>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Only show customer info fields if user is not signed in */}
                {!user && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-[var(--coffee-brown)]">
                        Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={customerInfo.name}
                        onChange={(e) => {
                          setCustomerInfo({ ...customerInfo, name: e.target.value });
                          if (validationErrors.name) {
                            setValidationErrors({ ...validationErrors, name: "" });
                          }
                        }}
                        className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ${
                          validationErrors.name
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : "border-gray-300 focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                        }`}
                        placeholder="John Doe"
                      />
                      {validationErrors.name && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-[var(--coffee-brown)]">
                        Phone *
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerInfo.phone}
                        onChange={(e) => {
                          setCustomerInfo({
                            ...customerInfo,
                            phone: e.target.value,
                          });
                          if (validationErrors.phone) {
                            setValidationErrors({ ...validationErrors, phone: "" });
                          }
                        }}
                        className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ${
                          validationErrors.phone
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : "border-gray-300 focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                        }`}
                        placeholder="(555) 123-4567"
                      />
                      {validationErrors.phone && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.phone}</p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-[var(--coffee-brown)]">
                        Email
                      </label>
                      <input
                        type="email"
                        value={customerInfo.email}
                        onChange={(e) => {
                          setCustomerInfo({
                            ...customerInfo,
                            email: e.target.value,
                          });
                          if (validationErrors.email) {
                            setValidationErrors({ ...validationErrors, email: "" });
                          }
                        }}
                        className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ${
                          validationErrors.email
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : "border-gray-300 focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                        }`}
                        placeholder="john@example.com (optional)"
                      />
                      {validationErrors.email && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--coffee-brown)]">
                    Preferred Pickup Time *
                  </label>
                  
                  {/* Date Picker */}
                  <div className="mb-3 relative" data-date-picker>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDatePicker(!showDatePicker);
                        setShowTimePicker(false);
                        // Clear validation error when user interacts
                        if (validationErrors.pickupDate) {
                          setValidationErrors({ ...validationErrors, pickupDate: "" });
                        }
                      }}
                      className={`w-full rounded-lg border px-4 py-2 text-left focus:outline-none focus:ring-2 bg-white flex items-center justify-between ${
                        validationErrors.pickupDate
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                      }`}
                    >
                      <span className={selectedDate ? "text-[var(--coffee-brown)]" : "text-gray-500"}>
                        {selectedDate
                          ? formatDateDisplay(selectedDate, isTodayDate(selectedDate))
                          : "Select Date"}
                      </span>
                      <svg
                        className={`h-5 w-5 text-gray-400 transition-transform ${showDatePicker ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    
                    {validationErrors.pickupDate && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.pickupDate}</p>
                    )}
                    
                    {showDatePicker && (
                      <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-300 bg-white shadow-lg max-h-60 overflow-y-auto">
                        {getAvailableDates().map((date) => (
                          <button
                            key={date.value}
                            type="button"
                            onClick={() => handleDateSelect(date.value)}
                            className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors ${
                              selectedDate === date.value
                                ? "bg-[var(--lime-green)] text-white hover:bg-[var(--lime-green-dark)]"
                                : "text-[var(--coffee-brown)]"
                            }`}
                          >
                            {date.display}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Time Picker */}
                  {selectedDate && (
                    <div className="relative" data-time-picker>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTimePicker(!showTimePicker);
                          setShowDatePicker(false);
                          // Clear validation error when user interacts
                          if (validationErrors.pickupTime) {
                            setValidationErrors({ ...validationErrors, pickupTime: "" });
                          }
                        }}
                        className={`w-full rounded-lg border px-4 py-2 text-left focus:outline-none focus:ring-2 bg-white flex items-center justify-between ${
                          validationErrors.pickupTime
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : "border-gray-300 focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                        }`}
                      >
                        <span className={selectedTime ? "text-[var(--coffee-brown)]" : "text-gray-500"}>
                          {selectedTime
                            ? getTimeSlotsForDate(selectedDate).find((slot) => slot.value === selectedTime)?.display || selectedTime
                            : "Select Time"}
                        </span>
                        <svg
                          className={`h-5 w-5 text-gray-400 transition-transform ${showTimePicker ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      
                      {validationErrors.pickupTime && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.pickupTime}</p>
                      )}
                      
                      {showTimePicker && (
                        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-300 bg-white shadow-lg max-h-60 overflow-y-auto">
                          {getTimeSlotsForDate(selectedDate).length > 0 ? (
                            getTimeSlotsForDate(selectedDate).map((slot) => (
                              <button
                                key={slot.value}
                                type="button"
                                onClick={() => handleTimeSelect(slot.value)}
                                className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors ${
                                  selectedTime === slot.value
                                    ? "bg-[var(--lime-green)] text-white hover:bg-[var(--lime-green-dark)]"
                                    : "text-[var(--coffee-brown)]"
                                }`}
                              >
                                {slot.display}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-2 text-sm text-gray-500">
                              No available time slots for this date
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!selectedDate && (
                    <p className="text-sm text-gray-500 mt-1">
                      Please select a date first
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--coffee-brown)]">
                    Special Instructions
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-[var(--lime-green)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)]"
                    placeholder="Any special requests or notes..."
                  />
                </div>

                {!showPayment ? (
                  <>
                    <button
                      type="submit"
                      disabled={loading || !selectedDate || !selectedTime}
                      className="w-full rounded-full bg-[var(--lime-green)] px-6 py-3 text-white font-semibold transition-colors hover:bg-[var(--lime-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue to Payment
                    </button>
                    {(!selectedDate || !selectedTime) && (
                      <p className="text-center text-xs text-gray-500 mt-2">
                        Please select a pickup date and time to continue
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <PaymentForm
                      amount={calculateTotals().total}
                      onPaymentSuccess={handlePaymentSuccess}
                      onPaymentError={handlePaymentError}
                      disabled={paymentProcessing || loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPayment(false)}
                      className="w-full rounded-full border-2 border-gray-300 px-6 py-2 text-gray-700 font-semibold transition-colors hover:bg-gray-50"
                    >
                      Back to Order Details
                    </button>
                  </div>
                )}

                {paymentProcessing && (
                  <p className="text-center text-xs text-gray-500">
                    Processing your order...
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

