"use client";

import { Suspense, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { locationApi, ordersApi, paymentsApi, menuApi, loyaltyApi } from "@/lib/api";
import { applyBeanStampsToCart } from "@/lib/beanStampsPricing";
import {
  BEAN_STAMPS_ENABLED,
  LOYALTY_FREE_ITEM_MAX_PRE_TAX,
  LOYALTY_STAMPS_PER_REWARD,
  REWARD_ASSETS,
} from "@/lib/loyaltyConstants";
import { useAuth } from "@/hooks/useAuth";
import Lottie from "lottie-react";
import CustomizationModal from "@/components/CustomizationModal";
import BeanStampsPromo from "@/components/BeanStampsPromo";
import { ADMIN_ORDER_COMP_ENABLED, GRAND_OPENING_DATE } from "@/lib/constants";
import {
  getPickupLeadTimeError,
  getPickupLeadTimeErrorFromIso,
} from "@/lib/pickupValidation";

function OrderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [now, setNow] = useState(() =>
    typeof window !== "undefined" ? Date.now() : 0,
  );
  const isOrderingOpenToAll = now >= GRAND_OPENING_DATE.getTime();

  // Admin emails - only admins can place orders before grand opening; their orders are comped for QA/testing
  const ADMIN_EMAILS = [
    "danielwoldehana@yahoo.com",
    "info@wildbeancoffeeshop.com",
  ];
  const isAdmin =
    user && user.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
  const adminCompActive = isAdmin && ADMIN_ORDER_COMP_ENABLED;

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
    firstName: "",
    lastName: "",
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
  const [storeHours, setStoreHours] = useState({
    open: 6,
    close: 20,
    closeMinute: 0,
  }); // Default fallback (6am-8pm)
  const [locationHours, setLocationHours] = useState(null); // Per-day hours from API for selected-date time slots
  const [successAnimation, setSuccessAnimation] = useState(null);

  /** Bean Stamps (signed-in only; server enforces) */
  const [loyalty, setLoyalty] = useState(null);
  const [beanStampsRedeemCartKey, setBeanStampsRedeemCartKey] = useState(null);

  /** Optional tip: percent of pre-tax subtotal; "none" | "10" | "15" | "18" | "custom". Tap again to clear. */
  const [tipChip, setTipChip] = useState("none");
  const [tipCustomStr, setTipCustomStr] = useState("");

  // Customization modal state
  const [isCustomizationModalOpen, setIsCustomizationModalOpen] =
    useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);

  // Get the section to return to from URL params
  const fromSection = searchParams.get("fromSection");

  // Tax rate (6% - adjust as needed)
  const taxRate = 0.06;

  // Update "now" every second so ordering opens to all automatically when grand opening time is reached
  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Load cart from localStorage; remove in-store-only menu items (e.g. pastries)
    const loadCart = async () => {
      const savedCart = localStorage.getItem("cart");
      let parsed = savedCart ? JSON.parse(savedCart) : [];
      try {
        const menuItems = await menuApi.getAll();
        const inStoreOnlyIds = new Set(
          menuItems
            .filter((m) => m.onlineOrderable === false)
            .map((m) => String(m._id)),
        );
        if (inStoreOnlyIds.size > 0) {
          const filtered = parsed.filter(
            (line) => !inStoreOnlyIds.has(String(line._id)),
          );
          if (filtered.length !== parsed.length) {
            parsed = filtered;
            localStorage.setItem("cart", JSON.stringify(parsed));
          }
        }
      } catch (e) {
        console.error("Failed to sync cart with menu", e);
      }
      setCart(parsed);
    };
    loadCart();

    // Fetch store hours from API (single source of truth)
    const fetchStoreHours = async () => {
      try {
        const location = await locationApi.getLocation();
        if (location?.hours && location.hours.length > 0) {
          // Get hours for today (or use first day as default)
          const today = new Date();
          const dayName = today.toLocaleDateString("en-US", {
            weekday: "long",
          });
          const todayHours =
            location.hours.find((h) => h.day === dayName) || location.hours[0];

          if (todayHours && !todayHours.closed) {
            // Parse opening and closing times (format: "HH:mm")
            const openTime = todayHours.opens?.split(":") || ["07", "00"];
            const closeTime = todayHours.closes?.split(":") || ["20", "00"];

            setStoreHours({
              open: parseInt(openTime[0], 10),
              close: parseInt(closeTime[0], 10),
              closeMinute: parseInt(closeTime[1], 10) || 0,
            });
          }
          setLocationHours(location.hours);
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
          console.error(
            "Failed to parse SuccessToast Lottie JSON:",
            parseError,
          );
        }
      })
      .catch((err) =>
        console.error("Failed to load SuccessToast Lottie animation:", err),
      );
  }, []);

  // Pre-fill customer info when user is signed in
  useEffect(() => {
    if (user && !authLoading) {
      setCustomerInfo({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
        email: user.email || "",
      });
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!BEAN_STAMPS_ENABLED) {
      setLoyalty(null);
      setBeanStampsRedeemCartKey(null);
      return;
    }
    if (!user) {
      setLoyalty(null);
      setBeanStampsRedeemCartKey(null);
      return;
    }
    let cancelled = false;
    loyaltyApi
      .getMe()
      .then((data) => {
        if (!cancelled) setLoyalty(data);
      })
      .catch(() => {
        if (!cancelled) setLoyalty(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!beanStampsRedeemCartKey) return;
    const exists = cart.some(
      (i) => (i.cartKey || i._id) === beanStampsRedeemCartKey,
    );
    if (!exists) setBeanStampsRedeemCartKey(null);
  }, [cart, beanStampsRedeemCartKey]);

  useEffect(() => {
    if (adminCompActive || !BEAN_STAMPS_ENABLED) setBeanStampsRedeemCartKey(null);
  }, [adminCompActive]);

  // Calculate the first available time slot for today (next 10-min increment from now, but not before store open)
  const getFirstAvailableTime = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Next 10-minute mark from now (e.g. 4:10 → 4:20, 4:21 → 4:30)
    let firstHour = currentHour;
    let firstMinute = Math.ceil((currentMinute + 1) / 10) * 10;

    if (firstMinute >= 60) {
      firstHour += 1;
      firstMinute = 0;
    }

    // If before store open, start at store open time
    const openMin = 0;
    if (
      firstHour < storeHours.open ||
      (firstHour === storeHours.open && firstMinute < openMin)
    ) {
      firstHour = storeHours.open;
      firstMinute = 0;
    }

    // If after store close time, no slots available for today
    const closeMin = storeHours.closeMinute ?? 0;
    if (
      firstHour > storeHours.close ||
      (firstHour === storeHours.close && firstMinute >= closeMin)
    ) {
      return null;
    }

    return { hour: firstHour, minute: firstMinute };
  };

  // Generate time slots for a given date
  const getTimeSlotsForDate = (dateString) => {
    const slots = [];
    const isToday = isTodayDate(dateString);

    // Resolve open/close for this date (per-day hours; support half-hour close e.g. 6:30pm)
    let openHour = storeHours.open;
    let openMinute = 0;
    let closeHour = storeHours.close;
    let closeMinute = storeHours.closeMinute ?? 0;
    if (!isToday && locationHours?.length) {
      const date = new Date(dateString + "T12:00:00");
      const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
      const dayHours = locationHours.find((h) => h.day === dayName);
      if (
        dayHours &&
        !dayHours.closed &&
        dayHours.opens != null &&
        dayHours.closes != null
      ) {
        const openParts = (dayHours.opens || "06:00").split(":").map(Number);
        const closeParts = (dayHours.closes || "20:00").split(":").map(Number);
        openHour = openParts[0];
        openMinute = openParts[1] || 0;
        closeHour = closeParts[0];
        closeMinute = closeParts[1] || 0;
      }
    }

    const beforeClose = (h, m) =>
      h < closeHour || (h === closeHour && m < closeMinute);

    if (isToday) {
      const firstTime = getFirstAvailableTime();
      if (!firstTime) {
        return [];
      }

      let hour = firstTime.hour;
      let minute = firstTime.minute;
      const todayCloseMin = storeHours.closeMinute ?? 0;

      while (
        hour < storeHours.close ||
        (hour === storeHours.close && minute < todayCloseMin)
      ) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        const displayTime = formatTimeDisplay(hour, minute);
        slots.push({ value: timeString, display: displayTime });

        minute += 10;
        if (minute >= 60) {
          hour += 1;
          minute = 0;
        }
      }
    } else {
      // For future dates, use that day's open/close
      let hour = openHour;
      let minute = openMinute;
      // Snap to next 10-min increment if open is e.g. 9:05
      if (minute % 10 !== 0) {
        minute = Math.ceil(minute / 10) * 10;
        if (minute >= 60) {
          hour += 1;
          minute = 0;
        }
      }

      while (beforeClose(hour, minute)) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        const displayTime = formatTimeDisplay(hour, minute);
        slots.push({ value: timeString, display: displayTime });

        minute += 10;
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
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

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

  // Update pickupTime when both date and time are selected.
  // Build a Date in the user's local timezone and send ISO (UTC) so the server stores
  // the correct moment; otherwise the server would parse "YYYY-MM-DDTHH:mm:00" as UTC
  // and the kitchen would show the wrong time (e.g. 5 PM local showing as 12 PM).
  useEffect(() => {
    if (selectedDate && selectedTime) {
      const [y, m, d] = selectedDate.split("-").map(Number);
      const [hr, min] = selectedTime.split(":").map(Number);
      const localDate = new Date(y, m - 1, d, hr, min, 0, 0);
      setPickupTime(localDate.toISOString());
    } else {
      setPickupTime("");
    }
  }, [selectedDate, selectedTime]);

  // Invalidate pickup if the minimum-lead window passes while the user is idle or away from the tab.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const revalidateStalePickup = () => {
      if (!selectedDate || !selectedTime) return;
      const msg = getPickupLeadTimeError(selectedDate, selectedTime);
      if (!msg) return;
      setSelectedTime("");
      setPickupTime("");
      setValidationErrors((prev) => ({ ...prev, pickupTime: msg }));
      setShowPayment(false);
    };

    const intervalId = setInterval(revalidateStalePickup, 60_000);
    const onWinFocus = () => revalidateStalePickup();
    const onVisibility = () => {
      if (document.visibilityState === "visible") revalidateStalePickup();
    };
    window.addEventListener("focus", onWinFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", onWinFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [selectedDate, selectedTime]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDatePicker || showTimePicker) {
        const target = event.target;
        if (
          !target.closest("[data-date-picker]") &&
          !target.closest("[data-time-picker]")
        ) {
          setShowDatePicker(false);
          setShowTimePicker(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker, showTimePicker]);

  const updateQuantity = (itemKey, change) => {
    setCart((prevCart) => {
      const updated = prevCart
        .map((item) => {
          const key = item.cartKey || item._id;
          if (key === itemKey) {
            const newQuantity = item.quantity + change;
            if (newQuantity <= 0) return null;
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter(Boolean);

      localStorage.setItem("cart", JSON.stringify(updated));
      return updated;
    });
  };

  const removeItem = (itemKey) => {
    setCart((prevCart) => {
      const updated = prevCart.filter((item) => {
        const key = item.cartKey || item._id;
        return key !== itemKey;
      });
      localStorage.setItem("cart", JSON.stringify(updated));
      return updated;
    });
  };

  // Handle editing a cart item
  const handleEditItem = async (cartItem) => {
    // If cart item doesn't have modifierGroups, fetch the full menu item
    if (!cartItem.modifierGroups || cartItem.modifierGroups.length === 0) {
      try {
        const fullMenuItem = await menuApi.getById(cartItem._id);
        // Merge the full menu item with the cart item's current state (quantity, modifiers, etc.)
        setItemToEdit({
          ...fullMenuItem,
          quantity: cartItem.quantity,
          modifiers: cartItem.modifiers,
          modifierTotal: cartItem.modifierTotal,
          cartKey: cartItem.cartKey,
        });
      } catch (error) {
        console.error("Error fetching menu item:", error);
        // Fallback to using cart item as-is
        setItemToEdit(cartItem);
      }
    } else {
      setItemToEdit(cartItem);
    }
    setIsCustomizationModalOpen(true);
  };

  // Handle updating cart item from customization modal
  const handleUpdateCartItem = (updatedCartItem) => {
    setCart((prevCart) => {
      const itemKey = itemToEdit?.cartKey || itemToEdit?._id;
      if (!itemKey) return prevCart;

      const updated = prevCart.map((item) => {
        const key = item.cartKey || item._id;
        if (key === itemKey) {
          // Update the item with new modifiers and recalculate cartKey
          const newCartKey =
            updatedCartItem.cartKey ||
            `${updatedCartItem._id}_${JSON.stringify(updatedCartItem.modifiers || [])}`;
          return {
            ...updatedCartItem,
            cartKey: newCartKey,
            quantity: item.quantity, // Preserve quantity
          };
        }
        return item;
      });

      localStorage.setItem("cart", JSON.stringify(updated));
      return updated;
    });
    setIsCustomizationModalOpen(false);
    setItemToEdit(null);
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => {
      const basePrice = item.price || 0;
      const modifierTotal = item.modifierTotal || 0;
      const itemPrice = basePrice + modifierTotal;
      return sum + itemPrice * item.quantity;
    }, 0);
    const tax = subtotal * taxRate;
    const beforeDiscount = subtotal + tax;

    // Apply 100% discount for admins when QA comp is enabled
    const discount = adminCompActive ? beforeDiscount : 0;
    const total = adminCompActive ? 0 : beforeDiscount;

    return { subtotal, tax, discount, total, isAdmin: adminCompActive };
  };

  const getCheckoutCart = () => {
    if (!BEAN_STAMPS_ENABLED) return cart;
    if (!user || !beanStampsRedeemCartKey || adminCompActive) return cart;
    const applied = applyBeanStampsToCart(cart, beanStampsRedeemCartKey, taxRate);
    return applied ? applied.cart : cart;
  };

  const getTipPercent = () => {
    if (tipChip === "none") return 0;
    if (tipChip === "custom") {
      const n = parseFloat(tipCustomStr);
      if (!Number.isFinite(n) || n < 0) return 0;
      return Math.min(50, n);
    }
    return Number(tipChip);
  };

  const getCheckoutTotals = () => {
    const lines = getCheckoutCart();
    let foodSubtotalCents = 0;
    for (const item of lines) {
      const basePrice = item.price || 0;
      const modifierTotal = item.modifierTotal || 0;
      const itemPrice = basePrice + modifierTotal;
      const unit = Math.round(itemPrice * 100);
      const qty = Math.max(1, Number(item.quantity) || 1);
      foodSubtotalCents += unit * qty;
    }
    const subtotal = foodSubtotalCents / 100;
    const taxCents = Math.round(foodSubtotalCents * taxRate);
    const tax = taxCents / 100;
    const beforeDiscountCents = foodSubtotalCents + taxCents;
    const discount = adminCompActive ? beforeDiscountCents / 100 : 0;
    const tipPct = adminCompActive ? 0 : getTipPercent();
    const tipCents = adminCompActive
      ? 0
      : Math.round((foodSubtotalCents * tipPct) / 100);
    const tipAmount = tipCents / 100;
    const totalCents = adminCompActive ? 0 : foodSubtotalCents + taxCents + tipCents;
    const total = totalCents / 100;
    return {
      subtotal,
      tax,
      discount,
      tipAmount,
      tipPercent: tipPct,
      total,
      isAdmin: adminCompActive,
    };
  };

  const mapCartToOrderItems = (lines) =>
    lines.map((item) => {
      const basePrice = item.price || 0;
      const modifierTotal = item.modifierTotal || 0;
      const itemPrice = basePrice + modifierTotal;
      return {
        itemType: item.itemType || "product",
        itemId: item._id,
        name: item.name,
        price: itemPrice,
        quantity: item.quantity,
        modifiers: item.modifiers || [],
        modifierTotal,
        cartKey: String(item.cartKey || item._id),
      };
    });

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
      if (!customerInfo.firstName || !customerInfo.firstName.trim()) {
        errors.firstName = "First name is required";
      }

      if (!customerInfo.phone || !customerInfo.phone.trim()) {
        errors.phone = "Phone number is required";
      } else if (!validatePhone(customerInfo.phone)) {
        errors.phone = "Please enter a valid phone number (at least 10 digits)";
      }

      // Email is required for payment processing
      if (!customerInfo.email || !customerInfo.email.trim()) {
        errors.email = "Email is required";
      } else if (!validateEmail(customerInfo.email)) {
        errors.email = "Please enter a valid email address";
      }
    } else {
      // If user is signed in, ensure they have email
      if (!user.email && !customerInfo.email) {
        errors.email = "Email is required";
      }
    }

    // Validate pickup date and time
    if (!selectedDate) {
      errors.pickupDate = "Please select a pickup date";
    }

    if (!selectedTime) {
      errors.pickupTime = "Please select a pickup time";
    } else if (selectedDate) {
      const leadErr = getPickupLeadTimeError(selectedDate, selectedTime);
      if (leadErr) {
        errors.pickupTime = leadErr;
      }
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

    // Create Hosted Checkout session and redirect
    await handleCreateCheckout();
  };

  const handleCreateCheckout = async () => {
    setError(null);

    if (!validateForm()) {
      setShowPayment(false);
      setError("Please fix the issues above before continuing.");
      return;
    }

    setPaymentProcessing(true);

    try {
      if (BEAN_STAMPS_ENABLED && beanStampsRedeemCartKey) {
        if (!loyalty?.rewardReady) {
          throw new Error(
            "Your Bean Stamps reward isn’t available. Refresh the page or visit Rewards.",
          );
        }
      }

      const { total, tipAmount, isAdmin: isAdminDiscount } =
        getCheckoutTotals();

      // If admin, skip payment and create order directly
      if (isAdminDiscount && total === 0) {
        await handleAdminOrder();
        return;
      }

      if (total <= 0) {
        throw new Error(
          "Order total must be greater than zero. Add another item or remove the reward if your cart total is covered by the reward discount.",
        );
      }

      const checkoutCart = getCheckoutCart();

      // Prepare order items with modifiers (Clover / receipt)
      const orderItems = checkoutCart.map((item) => {
        const basePrice = item.price || 0;
        const modifierTotal = item.modifierTotal || 0;
        const itemPrice = basePrice + modifierTotal;

        return {
          name: item.name,
          quantity: item.quantity,
          price: itemPrice,
          modifiers: item.modifiers || [],
          modifierTotal: modifierTotal,
        };
      });

      // Prepare customer data
      const customerData = user
        ? {
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            email: user.email || customerInfo.email || "",
            phone: user.phone || "",
          }
        : {
            firstName: customerInfo.firstName || "",
            lastName: customerInfo.lastName || "",
            email: customerInfo.email || "",
            phone: customerInfo.phone || "",
          };

      // Validate customer data before sending
      if (!customerData.firstName || !customerData.firstName.trim()) {
        throw new Error("First name is required");
      }
      if (!customerData.email || !customerData.email.trim()) {
        throw new Error("Email is required");
      }

      console.log(
        "[ORDER PAGE] Customer data being sent:",
        JSON.stringify(
          {
            firstName: customerData.firstName,
            lastName: customerData.lastName,
            email: customerData.email,
            hasPhone: !!customerData.phone,
          },
          null,
          2,
        ),
      );

      // Build redirect URLs using production domain
      const baseUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://wildbeancoffeeshop.com";
      // Include placeholder for checkout session ID (Clover replaces it with actual ID)
      const successUrl = `${baseUrl}/order/success?checkoutId={CHECKOUT_SESSION_ID}`;
      const failureUrl = `${baseUrl}/order/failure`;
      const cancelUrl = `${baseUrl}/order?canceled=true`;

      const orderCustomerData = {
        name: [customerData.firstName, customerData.lastName]
          .map((s) => (s || "").trim())
          .filter(Boolean)
          .join(" "),
        phone: customerData.phone || "",
        email: customerData.email || undefined,
      };

      const orderDraft = {
        customer: orderCustomerData,
        items: mapCartToOrderItems(checkoutCart),
        taxRate,
        pickupTime: pickupTime || undefined,
        notes: notes || undefined,
        ...(tipAmount > 0 ? { tip: tipAmount } : {}),
        ...(BEAN_STAMPS_ENABLED && beanStampsRedeemCartKey
          ? { beanStampsRedeemCartKey }
          : {}),
      };

      // Create checkout session (server persists orderDraft for webhook / recovery)
      const tipAmountCents = Math.round(tipAmount * 100);
      const checkoutSession = await paymentsApi.createCheckout({
        items: orderItems,
        customer: customerData,
        amount: Math.round(total * 100), // Convert to cents
        tipAmountCents,
        orderDraft,
        successUrl,
        failureUrl,
        cancelUrl,
        taxRate,
        currency: "USD",
      });

      const orderData = {
        ...orderDraft,
        checkoutId: checkoutSession.checkoutId,
      };
      sessionStorage.setItem("pendingOrder", JSON.stringify(orderData));

      // Redirect to Clover Hosted Checkout
      if (checkoutSession.checkoutUrl) {
        window.location.href = checkoutSession.checkoutUrl;
      } else {
        throw new Error("No checkout URL received from server");
      }
    } catch (err) {
      console.error("Error creating checkout session:", err);
      setError(err.message || "Failed to initiate payment. Please try again.");
      setPaymentProcessing(false);
    }
  };

  const handleAdminOrder = async () => {
    setPaymentProcessing(true);
    setError(null);

    try {
      const checkoutCart = getCheckoutCart();
      const orderItems = mapCartToOrderItems(checkoutCart);

      // Use user info if signed in, otherwise use form data
      const customerData = user
        ? {
            name: [user.firstName, user.lastName]
              .map((s) => (s || "").trim())
              .filter(Boolean)
              .join(" "),
            phone: user.phone,
            email: user.email || undefined,
          }
        : {
            name: [customerInfo.firstName, customerInfo.lastName]
              .map((s) => (s || "").trim())
              .filter(Boolean)
              .join(" "),
            phone: customerInfo.phone,
            email: customerInfo.email || undefined,
          };

      const orderData = {
        customer: customerData,
        items: orderItems,
        taxRate,
        pickupTime: pickupTime || undefined,
        notes: notes || undefined,
        paymentStatus: "paid", // Admin orders are automatically paid
        paymentRef: "ADMIN_DISCOUNT", // Special identifier for admin orders
      };

      setLoading(true);
      const result = await ordersApi.create(orderData);
      setOrderId(result._id);
      setOrderPlaced(true);

      // Clear cart
      localStorage.removeItem("cart");
      setCart([]);
    } catch (err) {
      setError(err.message || "Failed to create order. Please try again.");
    } finally {
      setLoading(false);
      setPaymentProcessing(false);
    }
  };

  const handlePaymentSuccess = async (paymentResult) => {
    setPaymentData(paymentResult);
    setPaymentProcessing(true);
    setError(null);

    const isoLeadErr = getPickupLeadTimeErrorFromIso(pickupTime);
    if (isoLeadErr) {
      setValidationErrors((prev) => ({ ...prev, pickupTime: isoLeadErr }));
      setPaymentProcessing(false);
      setError(isoLeadErr);
      return;
    }

    try {
      const checkoutCart = getCheckoutCart();
      const orderItems = mapCartToOrderItems(checkoutCart);

      // Use user info if signed in, otherwise use form data
      const customerData = user
        ? {
            name: [user.firstName, user.lastName]
              .map((s) => (s || "").trim())
              .filter(Boolean)
              .join(" "),
            phone: user.phone,
            email: user.email || undefined,
          }
        : {
            name: [customerInfo.firstName, customerInfo.lastName]
              .map((s) => (s || "").trim())
              .filter(Boolean)
              .join(" "),
            phone: customerInfo.phone,
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
        ...(BEAN_STAMPS_ENABLED && beanStampsRedeemCartKey
          ? { beanStampsRedeemCartKey }
          : {}),
      };

      setLoading(true);
      const result = await ordersApi.create(orderData);
      setOrderId(result._id);

      // Attempt to print receipt (non-blocking)
      try {
        await fetch("/api/payments/print-receipt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId: result._id,
          }),
        });
      } catch (printError) {
        console.error("Receipt printing failed:", printError);
        // Don't fail the order if printing fails
      }

      setOrderPlaced(true);

      // Clear cart
      localStorage.removeItem("cart");
      setCart([]);
    } catch (err) {
      setError(
        err.message ||
          "Failed to create order. Payment was successful, please contact support.",
      );
      // Payment was successful but order creation failed - this is a critical error
      // In production, you might want to implement a refund or manual order creation process
    } finally {
      setLoading(false);
      setPaymentProcessing(false);
    }
  };

  // Handle cancel redirect from Clover
  useEffect(() => {
    const canceled = searchParams?.get("canceled");
    if (canceled === "true") {
      setError("Payment was cancelled. You can try again when ready.");
      // Clear any pending order data
      sessionStorage.removeItem("pendingOrder");
      // Remove canceled param from URL
      router.replace("/order", { scroll: false });
    }
  }, [searchParams, router]);

  // Get directions to cafe
  const handleGetDirections = async () => {
    try {
      const location = await locationApi.getLocation();
      if (!location?.address1) {
        setError("Location information not available");
        return;
      }

      const address = `${location.address1}, ${location.city}, ${location.state} ${location.postalCode}`;
      const encodedAddress = encodeURIComponent(address);

      // Detect mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const userAgent = navigator.userAgent.toLowerCase();

      if (isMobile) {
        if (/iphone|ipad|ipod/.test(userAgent)) {
          // iOS - try Apple Maps first
          const appleMapsUrl = `maps://maps.apple.com/?daddr=${encodedAddress}&dirflg=d`;
          window.location.href = appleMapsUrl;

          // Fallback to Google Maps
          setTimeout(() => {
            const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
            window.open(googleMapsUrl, "_blank");
          }, 500);
        } else if (/android/.test(userAgent)) {
          // Android - use Google Maps navigation intent
          const intentUrl =
            location?.coordinates?.lat && location?.coordinates?.lng
              ? `google.navigation:q=${location.coordinates.lat},${location.coordinates.lng}`
              : `google.navigation:q=${encodedAddress}`;
          window.location.href = intentUrl;

          // Fallback to web
          setTimeout(() => {
            const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
            window.open(webUrl, "_blank");
          }, 500);
        } else {
          // Other mobile devices
          const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
          window.open(googleMapsUrl, "_blank");
        }
      } else {
        // Desktop - open Google Maps in new tab
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
        window.open(googleMapsUrl, "_blank");
      }
    } catch (err) {
      console.error("Error getting directions:", err);
      setError("Failed to get directions. Please try again.");
    }
  };

  // Online ordering is disabled for everyone except admins (return after all hooks)
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--coffee-brown-light)] border-t-[var(--lime-green)]" />
      </div>
    );
  }

  if (!isAdmin && !isOrderingOpenToAll) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-8 shadow-sm">
            <div className="mb-4 flex justify-center">
              <svg
                className="h-16 w-16 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="mb-4 text-3xl font-bold text-[var(--coffee-brown)]">
              Online Ordering Unavailable
            </h1>
            <p className="mb-6 text-lg text-gray-700">
              We're opening soon! Online ordering will be available Monday,
              February 16 at 6:00 AM.
            </p>
            <p className="mb-8 text-sm text-gray-600">
              We can't wait to serve you. Visit us in-store or call us once we
              open to place your order.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/shop"
                className="rounded-full bg-[var(--lime-green)] px-6 py-3 text-white font-semibold transition-colors hover:bg-[var(--lime-green-dark)]"
              >
                Continue Shopping
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
      </div>
    );
  }

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
                href={`/orders?orderId=${orderId}`}
                className="block rounded-full bg-[var(--lime-green)] px-6 py-3 text-white font-semibold transition-colors hover:bg-[var(--lime-green-dark)]"
              >
                Track Order
              </Link>
              <button
                onClick={handleGetDirections}
                className="w-full rounded-full border-2 border-[var(--coffee-brown)] px-6 py-3 text-[var(--coffee-brown)] font-semibold transition-colors hover:bg-gray-50"
              >
                Get Directions
              </button>
              <Link
                href="/"
                className="block rounded-full border-2 border-gray-300 px-6 py-3 text-gray-700 font-semibold transition-colors hover:bg-gray-50"
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
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center sm:items-stretch">
            <Link
              href="/menu"
              className="rounded-full border-2 border-[var(--coffee-brown)] px-6 py-3 text-[var(--coffee-brown)] font-semibold transition-colors hover:bg-gray-50 inline-flex items-center justify-center"
            >
              View Menu
            </Link>
            <Link
              href="/shop"
              className="rounded-full border-2 border-[var(--coffee-brown)] px-6 py-3 text-[var(--coffee-brown)] font-semibold transition-colors hover:bg-gray-50 inline-flex items-center justify-center"
            >
              Shop Coffee Beans
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { subtotal, tax, total, tipAmount, tipPercent } = getCheckoutTotals();
  const checkoutCartForDisplay = getCheckoutCart();
  const beanStampsRewardLineName = beanStampsRedeemCartKey
    ? cart.find(
        (i) => String(i.cartKey || i._id) === String(beanStampsRedeemCartKey),
      )?.name
    : null;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={
              fromSection
                ? `/menu?section=${encodeURIComponent(fromSection)}`
                : "/menu"
            }
            className="flex items-center gap-2 text-[var(--coffee-brown)] hover:text-[var(--coffee-brown-dark)] transition-colors"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="font-medium">Back to Menu</span>
          </Link>
        </div>
        <h1 className="mb-4 text-3xl font-bold text-[var(--coffee-brown)] sm:mb-5 sm:text-4xl">
          Checkout
        </h1>

        <BeanStampsPromo variant="checkout" />

        {user && BEAN_STAMPS_ENABLED && (
          <div className="mb-6 sm:mb-8 rounded-2xl border-2 border-[var(--lime-green)]/35 bg-gradient-to-br from-[var(--lime-green-light)]/45 via-white to-stone-50/80 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2 gap-y-1">
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-[var(--coffee-brown)]/60 sm:text-xs">
                      Bean Stamps
                    </p>
                    {loyalty ? (
                      <p className="mt-0.5 text-3xl font-bold tabular-nums text-[var(--coffee-brown)] sm:text-4xl">
                        {loyalty.stamps}
                        <span className="text-lg font-semibold text-[var(--coffee-brown)]/50 sm:text-xl">
                          {" "}
                          / {LOYALTY_STAMPS_PER_REWARD}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500">Loading…</p>
                    )}
                  </div>
                  {loyalty?.rewardReady && (
                    <span className="inline-flex items-center rounded-full bg-[var(--lime-green)] px-3 py-1 text-xs font-bold text-white shadow-sm sm:text-sm">
                      Reward ready
                    </span>
                  )}
                </div>
                {loyalty && (
                  <>
                    <div
                      className="h-2.5 w-full overflow-hidden rounded-full bg-white/80 ring-1 ring-[var(--coffee-brown)]/10 sm:h-3"
                      role="progressbar"
                      aria-valuenow={loyalty.stamps}
                      aria-valuemin={0}
                      aria-valuemax={LOYALTY_STAMPS_PER_REWARD}
                      aria-label={`${loyalty.stamps} of ${LOYALTY_STAMPS_PER_REWARD} stamps`}
                    >
                      <div
                        className="h-full rounded-full bg-[var(--lime-green)] transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.min(100, (loyalty.stamps / LOYALTY_STAMPS_PER_REWARD) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs leading-relaxed text-[var(--coffee-brown)]/80 sm:text-sm">
                      {loyalty.rewardReady ? (
                        "Tap Apply reward on your pick below, then check out."
                      ) : (
                        <>
                          {LOYALTY_STAMPS_PER_REWARD - loyalty.stamps} more stamp
                          {LOYALTY_STAMPS_PER_REWARD - loyalty.stamps === 1 ? "" : "s"} to your next reward.{" "}
                          <Link
                            href="/rewards/terms"
                            className="font-medium underline underline-offset-2 hover:text-[var(--lime-green-dark)]"
                          >
                            Program terms
                          </Link>{" "}
                          have qualifying details.
                        </>
                      )}
                    </p>
                  </>
                )}
              </div>
              <div className="flex shrink-0 sm:flex-col sm:justify-center sm:border-l sm:border-[var(--coffee-brown)]/10 sm:pl-6">
                <Link
                  href="/rewards"
                  className="inline-flex w-full items-center justify-center rounded-xl border-2 border-[var(--coffee-brown)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--coffee-brown)] transition-colors hover:bg-[var(--coffee-brown)] hover:text-white sm:w-auto sm:min-w-[9rem] sm:py-2.5"
                >
                  View rewards card
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Order Summary */}
          <div className="lg:col-span-2">
            <div className="rounded-lg bg-white p-6 shadow-md max-w-xl">
              <h2 className="mb-6 text-2xl font-semibold text-[var(--coffee-brown)]">
                Order Summary
              </h2>

              {BEAN_STAMPS_ENABLED && user && loyalty && !adminCompActive && (
                <div className="mb-4 rounded-xl border-2 border-[var(--lime-green)] bg-[var(--lime-green-light)]/40 px-4 py-3 text-sm text-[var(--coffee-brown)]">
                  <span className="font-semibold">Bean Stamps</span>
                  {loyalty.rewardReady ? (
                    <span className="ml-2 font-bold text-[var(--lime-green-dark)]">
                      Reward ready — use <strong>Apply reward</strong> on an eligible item before checkout.
                    </span>
                  ) : (
                    <span className="ml-2">
                      {loyalty.stamps}/{LOYALTY_STAMPS_PER_REWARD} stamps to your next reward (
                      <Link href="/rewards" className="underline font-medium text-[var(--coffee-brown)]">
                        card
                      </Link>
                      ).{" "}
                      <Link href="/rewards/terms" className="underline font-medium text-[var(--coffee-brown)]">
                        Program terms
                      </Link>{" "}
                      describe qualifying orders.
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-4">
                {checkoutCartForDisplay.map((item) => {
                  const basePrice = item.price || 0;
                  const modifierTotal = item.modifierTotal || 0;
                  const itemPrice = basePrice + modifierTotal;
                  const itemKey = String(item.cartKey || item._id);

                  return (
                    <motion.div
                      key={itemKey}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-3"
                    >
                      <div className="flex gap-4">
                        {/* Item Image */}
                        {item.image && (
                          <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        )}

                        {/* Item Details - constrained width */}
                        <div className="flex-1 min-w-0 max-w-full">
                          {/* Header with name and action buttons */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3 className="text-lg font-bold text-[var(--coffee-brown)] flex-1 min-w-0">
                              {item.name}
                            </h3>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {item.modifierGroups &&
                                item.modifierGroups.length > 0 && (
                                  <button
                                    onClick={() => {
                                      const full = cart.find(
                                        (i) =>
                                          (i.cartKey || i._id) === itemKey,
                                      );
                                      handleEditItem(full || item);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-[var(--lime-green)] hover:bg-[var(--lime-green)]/10 rounded-lg transition-all duration-200 group"
                                    aria-label="Edit item"
                                    title="Edit customization"
                                  >
                                    <Image
                                      src="/images/icons/edit.svg"
                                      alt="Edit"
                                      width={16}
                                      height={16}
                                      className="w-4 h-4 transition-transform duration-200 group-hover:scale-125"
                                      unoptimized
                                    />
                                  </button>
                                )}
                              <button
                                onClick={() => removeItem(itemKey)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 group"
                                aria-label="Remove item"
                                title="Remove"
                              >
                                <Image
                                  src="/images/icons/delete.svg"
                                  alt="Delete"
                                  width={16}
                                  height={16}
                                  className="w-4 h-4 transition-transform duration-200 group-hover:scale-125"
                                  unoptimized
                                />
                              </button>
                            </div>
                          </div>

                          {/* Base price */}
                          <div className="text-sm font-medium text-gray-700 mb-2">
                            {formatPrice(basePrice, item.currency)}
                          </div>

                          {/* Display modifiers - constrained to pricing width */}
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {item.modifiers.map((mod, idx) =>
                                mod.selectedOptions.map((opt, optIdx) => {
                                  const quantity = opt.quantity || 1;
                                  const optionTotal =
                                    (opt.price || 0) * quantity;
                                  const isQuantityBasedGroup =
                                    (mod.modifierGroupName || "").includes("Syrup Pumps") ||
                                    (mod.modifierGroupName || "").includes("Pumps") ||
                                    (mod.modifierGroupName || "").includes("Extra Single Shot");
                                  const isSyrupPump =
                                    (mod.modifierGroupName || "").includes("Syrup");
                                  const baseName = isSyrupPump
                                    ? (opt.name || "").replace(/\s+Pump\s*$/i, "").trim() || opt.name
                                    : opt.name;
                                  const pumpLabel =
                                    isSyrupPump
                                      ? quantity > 1
                                        ? " pumps"
                                        : " pump"
                                      : "";
                                  const displayLabel = isQuantityBasedGroup
                                    ? `${quantity} x ${baseName}${pumpLabel}`
                                    : opt.name;

                                  return (
                                    <div
                                      key={`${idx}-${optIdx}`}
                                      className="text-xs text-gray-600 flex items-center justify-between gap-3"
                                    >
                                      <span className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <span className="truncate">
                                          {displayLabel}
                                        </span>
                                      </span>
                                      {optionTotal > 0 && (
                                        <span className="text-gray-700 font-semibold whitespace-nowrap flex-shrink-0">
                                          +{formatPrice(optionTotal)}
                                        </span>
                                      )}
                                    </div>
                                  );
                                }),
                              )}
                            </div>
                          )}

                          {/* Quantity controls and total price - below modifiers */}
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(itemKey, -1)}
                                className="w-8 h-8 rounded-lg border-2 border-gray-300 flex items-center justify-center hover:border-[var(--lime-green)] hover:bg-[var(--lime-green)]/10 transition-colors text-gray-600 hover:text-[var(--lime-green)]"
                                aria-label="Decrease quantity"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M20 12H4"
                                  />
                                </svg>
                              </button>
                              <span className="w-10 text-center font-semibold text-gray-900">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(itemKey, 1)}
                                className="w-8 h-8 rounded-lg border-2 border-gray-300 flex items-center justify-center hover:border-[var(--lime-green)] hover:bg-[var(--lime-green)]/10 transition-colors text-gray-600 hover:text-[var(--lime-green)]"
                                aria-label="Increase quantity"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4v16m8-8H4"
                                  />
                                </svg>
                              </button>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-[var(--coffee-brown)]">
                                {formatPrice(
                                  itemPrice * item.quantity,
                                  item.currency,
                                )}
                              </p>
                            </div>
                          </div>

                          {BEAN_STAMPS_ENABLED &&
                            user &&
                            loyalty?.rewardReady &&
                            !adminCompActive &&
                            (() => {
                              const orig = cart.find(
                                (i) => (i.cartKey || i._id) === itemKey,
                              );
                              if (!orig) return null;
                              const linePre =
                                ((Number(orig.price) || 0) +
                                  (Number(orig.modifierTotal) || 0)) *
                                (orig.quantity || 1);
                              const over = Math.max(
                                0,
                                linePre - LOYALTY_FREE_ITEM_MAX_PRE_TAX,
                              );
                              return (
                                <div className="mt-2 space-y-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setBeanStampsRedeemCartKey((k) =>
                                        k === itemKey ? null : itemKey,
                                      )
                                    }
                                    className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                      beanStampsRedeemCartKey === itemKey
                                        ? "border-[var(--lime-green)] bg-[var(--lime-green)] text-white"
                                        : "border-[var(--coffee-brown)] text-[var(--coffee-brown)] hover:bg-[var(--lime-green-light)]"
                                    }`}
                                  >
                                    {beanStampsRedeemCartKey === itemKey ? (
                                      <>
                                        <svg
                                          className="h-4 w-4 shrink-0 opacity-95"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth={2.5}
                                          strokeLinecap="round"
                                          aria-hidden
                                        >
                                          <path d="M18 6L6 18M6 6l12 12" />
                                        </svg>
                                        <span>Remove reward</span>
                                      </>
                                    ) : (
                                      <>
                                        <Image
                                          src={REWARD_ASSETS.applyReward}
                                          alt=""
                                          width={20}
                                          height={20}
                                          unoptimized
                                        />
                                        <span>Apply reward</span>
                                      </>
                                    )}
                                  </button>
                                  {over > 0 &&
                                    beanStampsRedeemCartKey !== itemKey && (
                                      <p className="text-xs text-gray-600">
                                        If you apply the reward here, you’ll pay {formatPrice(over)} + tax on
                                        the pre-tax amount over ${LOYALTY_FREE_ITEM_MAX_PRE_TAX} for this pick.
                                      </p>
                                    )}
                                </div>
                              );
                            })()}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-6 border-t border-gray-200 pt-4">
                <div className="space-y-2">
                  {BEAN_STAMPS_ENABLED && beanStampsRedeemCartKey && (
                    <div className="flex justify-between text-sm text-[var(--lime-green-dark)] font-semibold">
                      <span>Bean Stamps reward</span>
                      <span className="text-right max-w-[65%]">
                        {beanStampsRewardLineName
                          ? `Applied to ${beanStampsRewardLineName}`
                          : "Applied to your pick"}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">{formatPrice(tax)}</span>
                  </div>
                  {!adminCompActive && (
                    <div className="rounded-xl border border-stone-200/90 bg-stone-50/50 px-3 py-3">
                      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--coffee-brown)]/45">
                        Optional Tip
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          { key: "10", label: "10%" },
                          { key: "15", label: "15%" },
                          { key: "18", label: "18%" },
                        ].map(({ key, label }) => {
                          const active = tipChip === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                if (active) {
                                  setTipChip("none");
                                  setTipCustomStr("");
                                } else {
                                  setTipChip(key);
                                  setTipCustomStr("");
                                }
                              }}
                              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                active
                                  ? "bg-[var(--coffee-brown)]/15 text-[var(--coffee-brown)] ring-1 ring-[var(--coffee-brown)]/25"
                                  : "bg-white/80 text-gray-600 ring-1 ring-stone-200/80 hover:bg-stone-100"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            if (tipChip === "custom") {
                              setTipChip("none");
                              setTipCustomStr("");
                            } else {
                              setTipChip("custom");
                            }
                          }}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            tipChip === "custom"
                              ? "bg-[var(--coffee-brown)]/15 text-[var(--coffee-brown)] ring-1 ring-[var(--coffee-brown)]/25"
                              : "bg-white/80 text-gray-600 ring-1 ring-stone-200/80 hover:bg-stone-100"
                          }`}
                        >
                          Other %
                        </button>
                      </div>
                      {tipChip === "custom" && (
                        <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                          <span className="shrink-0">Custom</span>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            step={0.5}
                            value={tipCustomStr}
                            onChange={(e) => setTipCustomStr(e.target.value)}
                            placeholder="e.g. 12"
                            className="w-20 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[var(--coffee-brown)] tabular-nums focus:border-[var(--lime-green)] focus:outline-none focus:ring-1 focus:ring-[var(--lime-green)]"
                          />
                          <span className="text-gray-500">% (max 50)</span>
                        </label>
                      )}
                    </div>
                  )}
                  {!adminCompActive && tipAmount > 0 && (
                    <div className="flex justify-between text-sm text-stone-600">
                      <span>
                        Tip
                        {tipPercent > 0 ? (
                          <span className="text-stone-400"> ({tipPercent}%)</span>
                        ) : null}
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatPrice(tipAmount)}
                      </span>
                    </div>
                  )}
                  {adminCompActive && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--lime-green)] font-semibold">
                        Admin (QA) — Comped
                      </span>
                      <span className="text-[var(--lime-green)] font-semibold">
                        -{formatPrice(subtotal + tax)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold">
                    <span className="text-[var(--coffee-brown)]">Total</span>
                    <span className="text-[var(--coffee-brown)]">
                      {formatPrice(total)}
                    </span>
                  </div>
                  {adminCompActive && (
                    <p className="text-xs text-center text-[var(--lime-green)] font-medium mt-2">
                      Admin order for QA/testing — No payment required
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="lg:col-span-3">
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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[var(--coffee-brown)]">
                          First Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={customerInfo.firstName}
                          onChange={(e) => {
                            setCustomerInfo({
                              ...customerInfo,
                              firstName: e.target.value,
                            });
                            if (validationErrors.firstName) {
                              setValidationErrors({
                                ...validationErrors,
                                firstName: "",
                              });
                            }
                          }}
                          className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ${
                            validationErrors.firstName
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : "border-gray-300 focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                          }`}
                          placeholder="John"
                        />
                        {validationErrors.firstName && (
                          <p className="mt-1 text-sm text-red-600">
                            {validationErrors.firstName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-[var(--coffee-brown)]">
                          Last Name{" "}
                          <span className="font-normal text-gray-500">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={customerInfo.lastName}
                          onChange={(e) => {
                            setCustomerInfo({
                              ...customerInfo,
                              lastName: e.target.value,
                            });
                            if (validationErrors.lastName) {
                              setValidationErrors({
                                ...validationErrors,
                                lastName: "",
                              });
                            }
                          }}
                          className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ${
                            validationErrors.lastName
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                              : "border-gray-300 focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                          }`}
                          placeholder="Doe"
                        />
                        {validationErrors.lastName && (
                          <p className="mt-1 text-sm text-red-600">
                            {validationErrors.lastName}
                          </p>
                        )}
                      </div>
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
                            setValidationErrors({
                              ...validationErrors,
                              phone: "",
                            });
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
                        <p className="mt-1 text-sm text-red-600">
                          {validationErrors.phone}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-[var(--coffee-brown)]">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={customerInfo.email}
                        onChange={(e) => {
                          setCustomerInfo({
                            ...customerInfo,
                            email: e.target.value,
                          });
                          if (validationErrors.email) {
                            setValidationErrors({
                              ...validationErrors,
                              email: "",
                            });
                          }
                        }}
                        className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ${
                          validationErrors.email
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : "border-gray-300 focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                        }`}
                        placeholder="john@example.com"
                      />
                      {validationErrors.email && (
                        <p className="mt-1 text-sm text-red-600">
                          {validationErrors.email}
                        </p>
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
                          setValidationErrors({
                            ...validationErrors,
                            pickupDate: "",
                          });
                        }
                      }}
                      className={`w-full rounded-lg border px-4 py-2 text-left focus:outline-none focus:ring-2 bg-white flex items-center justify-between ${
                        validationErrors.pickupDate
                          ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300 focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                      }`}
                    >
                      <span
                        className={
                          selectedDate
                            ? "text-[var(--coffee-brown)]"
                            : "text-gray-500"
                        }
                      >
                        {selectedDate
                          ? formatDateDisplay(
                              selectedDate,
                              isTodayDate(selectedDate),
                            )
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
                      <p className="mt-1 text-sm text-red-600">
                        {validationErrors.pickupDate}
                      </p>
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
                          const willOpen = !showTimePicker;
                          if (willOpen && selectedDate && selectedTime) {
                            const msg = getPickupLeadTimeError(
                              selectedDate,
                              selectedTime,
                            );
                            if (msg) {
                              setSelectedTime("");
                              setPickupTime("");
                              setValidationErrors((prev) => ({
                                ...prev,
                                pickupTime: msg,
                              }));
                              setShowPayment(false);
                              setShowTimePicker(false);
                              setShowDatePicker(false);
                              return;
                            }
                          }
                          setShowTimePicker(!showTimePicker);
                          setShowDatePicker(false);
                          if (willOpen && validationErrors.pickupTime) {
                            setValidationErrors((prev) => ({
                              ...prev,
                              pickupTime: "",
                            }));
                          }
                        }}
                        className={`w-full rounded-lg border px-4 py-2 text-left focus:outline-none focus:ring-2 bg-white flex items-center justify-between ${
                          validationErrors.pickupTime
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : "border-gray-300 focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                        }`}
                      >
                        <span
                          className={
                            selectedTime
                              ? "text-[var(--coffee-brown)]"
                              : "text-gray-500"
                          }
                        >
                          {selectedTime
                            ? getTimeSlotsForDate(selectedDate).find(
                                (slot) => slot.value === selectedTime,
                              )?.display || selectedTime
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
                        <p className="mt-1 text-sm text-red-600">
                          {validationErrors.pickupTime}
                        </p>
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
                      {adminCompActive ? "Place Order" : "Continue to Payment"}
                    </button>
                    {(!selectedDate || !selectedTime) && (
                      <p className="text-center text-xs text-gray-500 mt-2">
                        Please select a pickup date and time to continue
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    {adminCompActive ? (
                      <div className="rounded-lg border-2 border-[var(--lime-green)] bg-[var(--lime-green-light)] p-6 text-center">
                        <p className="mb-4 text-gray-700">
                          Admin order (QA/testing) — Comped to $0. No payment
                          required.
                        </p>
                        <button
                          type="button"
                          onClick={handleCreateCheckout}
                          disabled={paymentProcessing || loading}
                          className="w-full rounded-full bg-[var(--lime-green)] px-6 py-3 text-white font-semibold transition-colors hover:bg-[var(--lime-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {paymentProcessing ? "Processing..." : "Place Order"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-lg border-2 border-[var(--lime-green)] bg-[var(--lime-green-light)] p-6 text-center">
                          <p className="mb-4 text-gray-700">
                            You will be redirected to Clover's secure payment
                            page to complete your order.
                          </p>
                          <button
                            type="button"
                            onClick={handleCreateCheckout}
                            disabled={paymentProcessing || loading}
                            className="w-full rounded-full bg-[var(--lime-green)] px-6 py-3 text-white font-semibold transition-colors hover:bg-[var(--lime-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {paymentProcessing
                              ? "Processing..."
                              : `Proceed to Payment - ${formatPrice(getCheckoutTotals().total)}`}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowPayment(false)}
                          className="w-full rounded-full border-2 border-gray-300 px-6 py-2 text-gray-700 font-semibold transition-colors hover:bg-gray-50"
                        >
                          Back to Order Details
                        </button>
                      </>
                    )}
                  </div>
                )}

                {paymentProcessing && (
                  <p className="text-center text-xs text-gray-500">
                    Processing your order...
                  </p>
                )}
              </div>
            </form>
            <p className="mt-4 text-center text-xs text-gray-500">
              Allergen info is for awareness only. Cross-contamination may
              occur.{" "}
              <Link href="/terms" className="underline hover:text-gray-700">
                Terms of Use
              </Link>
              {BEAN_STAMPS_ENABLED && user && (
                <>
                  {" · "}
                  <Link
                    href="/rewards/terms"
                    className="underline hover:text-gray-700"
                  >
                    Bean Stamps terms
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Customization Modal */}
      {itemToEdit && (
        <CustomizationModal
          isOpen={isCustomizationModalOpen}
          onClose={() => {
            setIsCustomizationModalOpen(false);
            setItemToEdit(null);
          }}
          menuItem={itemToEdit}
          onAddToCart={handleUpdateCartItem}
          existingCartItem={itemToEdit}
        />
      )}
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[var(--lime-green)] border-r-transparent"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <OrderPageContent />
    </Suspense>
  );
}
