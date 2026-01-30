"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import ProfileDropdown from "./ProfileDropdown";
import Lottie from "lottie-react";
import Toast from "./Toast";

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const [userAvatarAnimation, setUserAvatarAnimation] = useState(null);
  const [toast, setToast] = useState(null);

  // Admin emails
  const ADMIN_EMAILS = ["danielwoldehana@yahoo.com", "wildbeancoffeellc@gmail.com"];
  const isAdmin = user && user.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  // Load userAvatar animation
  useEffect(() => {
    fetch("/animations/userAvatar.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        try {
          const data = JSON.parse(text);
          setUserAvatarAnimation(data);
        } catch (parseError) {
          console.error("Failed to parse userAvatar Lottie JSON:", parseError);
        }
      })
      .catch((err) => console.error("Failed to load userAvatar Lottie animation:", err));
  }, []);

  const isActive = (path) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  const linkClass = (path) => {
    const baseClass =
      "text-sm font-medium transition-colors relative after:absolute after:bottom-0 after:left-0 after:h-0.5 after:transition-all";
    if (isActive(path)) {
      return `${baseClass} text-[var(--lime-green)] after:w-full after:bg-[var(--lime-green)]`;
    }
    return `${baseClass} text-[var(--coffee-brown)] hover:text-[var(--lime-green)] after:w-0 after:bg-[var(--lime-green)] hover:after:w-full`;
  };

  const handleSignOutSuccess = (errorMessage) => {
    if (errorMessage) {
      setToast({
        message: errorMessage,
        type: "error",
        position: "center",
        autoClose: false,
      });
    } else {
      setToast({
        message: "You have been signed out successfully!",
        type: "success",
        position: "center",
        autoClose: false,
      });
    }
  };

  const handleToastClose = () => {
    const wasSuccess = toast?.type === "success";
    setToast(null);
    // Redirect to home after closing success toast
    if (wasSuccess) {
      setTimeout(() => {
        router.push("/");
      }, 100);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between overflow-visible">
          <Link href="/" className="flex items-center gap-2 overflow-visible">
            <Image
              src="/images/logo/LogoWtext.png"
              alt="Wild Bean Coffee"
              width={400}
              height={128}
              className="h-32 w-auto"
              priority
              unoptimized
            />
          </Link>
          <div className="hidden md:flex md:items-center md:gap-6">
            <Link href="/" className={linkClass("/")}>
              Home
            </Link>
            <Link href="/shop" className={linkClass("/shop")}>
              Shop
            </Link>
            <Link href="/menu" className={linkClass("/menu")}>
              Menu
            </Link>
            <Link href="/location" className={linkClass("/location")}>
              Location
            </Link>
            <Link
              href="/order"
              className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors ${
                isActive("/order")
                  ? "bg-[var(--lime-green-dark)]"
                  : "bg-[var(--lime-green)] hover:bg-[var(--lime-green-dark)]"
              }`}
            >
              Order Online
            </Link>
            {/* Kitchen Dashboard - Admin Only */}
            {isAdmin && (
              <Link
                href="/kitchen"
                className={`rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors ${
                  isActive("/kitchen")
                    ? "bg-[var(--coffee-brown-dark)]"
                    : "bg-[var(--coffee-brown)] hover:bg-[var(--coffee-brown-dark)]"
                }`}
              >
                Kitchen Dashboard
              </Link>
            )}
            {/* Auth Section */}
            {user ? (
              <ProfileDropdown
                user={user}
                onSignOut={signOut}
                userAvatarAnimation={userAvatarAnimation}
                onSignOutSuccess={handleSignOutSuccess}
              />
            ) : (
              <Link
                href="/auth"
                className="rounded-full px-4 py-2 text-sm font-semibold text-[var(--coffee-brown)] border-2 border-[var(--coffee-brown)] hover:bg-[var(--coffee-brown)] hover:text-white transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
          {/* Mobile menu button */}
          <button
            className="md:hidden"
            aria-label="Menu"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <svg
                className="h-6 w-6 text-[var(--coffee-brown)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6 text-[var(--coffee-brown)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="border-t border-gray-200 bg-white px-4 py-4 shadow-lg">
            <div className="flex flex-col space-y-4">
              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-base font-medium transition-colors ${
                  isActive("/")
                    ? "text-[var(--lime-green)]"
                    : "text-[var(--coffee-brown)] hover:text-[var(--lime-green)]"
                }`}
              >
                Home
              </Link>
              <Link
                href="/shop"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-base font-medium transition-colors ${
                  isActive("/shop")
                    ? "text-[var(--lime-green)]"
                    : "text-[var(--coffee-brown)] hover:text-[var(--lime-green)]"
                }`}
              >
                Shop
              </Link>
              <Link
                href="/menu"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-base font-medium transition-colors ${
                  isActive("/menu")
                    ? "text-[var(--lime-green)]"
                    : "text-[var(--coffee-brown)] hover:text-[var(--lime-green)]"
                }`}
              >
                Menu
              </Link>
              <Link
                href="/location"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-base font-medium transition-colors ${
                  isActive("/location")
                    ? "text-[var(--lime-green)]"
                    : "text-[var(--coffee-brown)] hover:text-[var(--lime-green)]"
                }`}
              >
                Location
              </Link>
              <Link
                href="/order"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`mt-2 rounded-full px-4 py-2 text-center text-base font-semibold text-white transition-colors ${
                  isActive("/order")
                    ? "bg-[var(--lime-green-dark)]"
                    : "bg-[var(--lime-green)] hover:bg-[var(--lime-green-dark)]"
                }`}
              >
                Order Online
              </Link>
              {/* Kitchen Dashboard - Admin Only (Mobile) */}
              {isAdmin && (
                <Link
                  href="/kitchen"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`mt-2 rounded-full px-4 py-2 text-center text-base font-semibold text-white transition-colors ${
                    isActive("/kitchen")
                      ? "bg-[var(--coffee-brown-dark)]"
                      : "bg-[var(--coffee-brown)] hover:bg-[var(--coffee-brown-dark)]"
                  }`}
                >
                  Kitchen Dashboard
                </Link>
              )}
              {/* Mobile Auth Section */}
              {user ? (
                <div className="mt-2 flex justify-center">
                  <ProfileDropdown
                    user={user}
                    onSignOut={signOut}
                    userAvatarAnimation={userAvatarAnimation}
                    onSignOutSuccess={handleSignOutSuccess}
                    onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
                  />
                </div>
              ) : (
                <Link
                  href="/auth"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mt-2 rounded-full px-4 py-2 text-center text-base font-semibold text-[var(--coffee-brown)] border-2 border-[var(--coffee-brown)] hover:bg-[var(--coffee-brown)] hover:text-white transition-colors"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={handleToastClose}
          position={toast.position || "center"}
          autoClose={toast.autoClose !== undefined ? toast.autoClose : false}
        />
      )}
    </nav>
  );
}
