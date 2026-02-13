"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Lottie from "lottie-react";

export default function ProfileDropdown({ user, onSignOut, userAvatarAnimation, onSignOutSuccess, onCloseMobileMenu }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleViewOrders = () => {
    setIsOpen(false);
    // Close mobile menu if callback is provided (for mobile view)
    if (onCloseMobileMenu) {
      onCloseMobileMenu();
    }
    // Small delay to ensure menu closes before navigation
    setTimeout(() => {
      router.push("/orders");
    }, 100);
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    // Close mobile menu if callback is provided (for mobile view)
    if (onCloseMobileMenu) {
      onCloseMobileMenu();
    }
    try {
      await onSignOut();
      // Notify parent component to show toast (before component unmounts)
      if (onSignOutSuccess) {
        onSignOutSuccess();
      }
    } catch (error) {
      console.error("Sign out error:", error);
      // Notify parent component to show error toast
      if (onSignOutSuccess) {
        onSignOutSuccess("Failed to sign out. Please try again.");
      }
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center rounded-full bg-[var(--lime-green-light)] p-2 transition-all hover:bg-[var(--lime-green)] hover:scale-110"
        aria-label="User menu"
      >
        {userAvatarAnimation ? (
          <div className="h-8 w-8">
            <Lottie
              animationData={userAvatarAnimation}
              loop={true}
              autoplay={true}
              className="h-full w-full"
            />
          </div>
        ) : (
          <div className="h-8 w-8 flex items-center justify-center text-white font-semibold">
            {user.firstName?.[0]?.toUpperCase() || "U"}
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-48 rounded-lg bg-white shadow-lg border border-gray-200 overflow-hidden z-[100]"
          >
            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-200 bg-[var(--coffee-brown-very-light)]">
              <p className="text-sm font-semibold text-[var(--coffee-brown)]">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-gray-600 truncate">{user.email}</p>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <button
                onClick={handleViewOrders}
                className="w-full px-4 py-2 text-left text-sm text-[var(--coffee-brown)] hover:bg-[var(--coffee-brown-very-light)] transition-colors flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Orders
              </button>
              <button
                onClick={handleSignOut}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

