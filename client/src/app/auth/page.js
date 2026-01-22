"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SignUpForm from "@/components/auth/SignUpForm";
import SignInForm from "@/components/auth/SignInForm";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import Toast from "@/components/Toast";
import { useAuth } from "@/hooks/useAuth";

export default function AuthPage() {
  const [mode, setMode] = useState("signin"); // "signin", "signup", or "forgot-password"
  const [toast, setToast] = useState(null);
  const { user, signUp, signIn, refetch } = useAuth();
  const router = useRouter();

  // Redirect if already signed in (but not immediately after sign up - let toast show first)
  useEffect(() => {
    // Only auto-redirect if user exists and we're not in the middle of showing a success toast
    if (user && !toast) {
      // Small delay to ensure state is synced
      const timer = setTimeout(() => {
        router.push("/");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, router, toast]);

  const handleSuccess = async (data) => {
    // Store token and user in localStorage immediately (SignUpForm already does this, but ensure it's done)
    if (data?.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    }
    
    // Dispatch event to notify all useAuth instances to update
    window.dispatchEvent(new Event("auth-state-changed"));
    
    // Refetch user data to update global state
    await refetch();
    
    // Small delay to ensure state propagates to all components
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Only show success toast for sign-up, not sign-in
    if (mode === "signup") {
      setToast({
        message: "Account created successfully!",
        type: "success",
        position: "center",
        autoClose: false, // Don't auto-close success toasts
      });
    } else {
      // For sign-in, just redirect (no toast needed)
      router.push("/");
    }
  };

  const handleError = (error) => {
    // Handle different error types for sign in
    if (mode === "signin" && typeof error === "object" && error.status) {
      if (error.status === 404) {
        // Email not found - show sign up prompt
        setToast({
          message: "Looks like this email hasn't been roasted in our system yet. Sign up?",
          type: "error",
          position: "center",
          autoClose: false, // Don't auto-close error toasts
          actionButton: (
            <button
              onClick={() => {
                setToast(null);
                setMode("signup");
              }}
              className="rounded-lg bg-[var(--lime-green)] px-6 py-2 text-white font-semibold transition-all hover:bg-[var(--lime-green-dark)] hover:scale-105 flex-1"
            >
              Sign Up
            </button>
          ),
        });
      } else if (error.status === 401) {
        // Wrong password
        setToast({
          message: "Login failed! But hey, at least your taste in coffee isn't wrong.",
          type: "error",
          position: "center",
          autoClose: false, // Don't auto-close error toasts
        });
      } else {
        // Other errors
        setToast({
          message: error.message || "An error occurred. Please try again.",
          type: "error",
          position: "center",
          autoClose: false, // Don't auto-close error toasts
        });
      }
    } else if (mode === "signup" && typeof error === "object" && error.status) {
      // Handle sign up errors
      if (error.status === 409) {
        // Email already exists - show sign in prompt
        setToast({
          message: "Your email is already caffeinated in our system. Sign in to get started?",
          type: "error",
          position: "center",
          autoClose: false, // Don't auto-close error toasts
          actionButton: (
            <button
              onClick={() => {
                setToast(null);
                setMode("signin");
              }}
              className="rounded-lg bg-[var(--lime-green)] px-6 py-2 text-white font-semibold transition-all hover:bg-[var(--lime-green-dark)] hover:scale-105 flex-1"
            >
              Sign In
            </button>
          ),
        });
      } else {
        // Other sign up errors
        setToast({
          message: error.message || "An error occurred. Please try again.",
          type: "error",
          position: "center",
          autoClose: false, // Don't auto-close error toasts
        });
      }
    } else {
      // Generic errors
      const errorMessage = typeof error === "string" ? error : error?.message || "An error occurred. Please try again.";
      setToast({
        message: errorMessage,
        type: "error",
        position: mode === "signin" ? "center" : "top-right",
        autoClose: false, // Don't auto-close error toasts
      });
    }
  };

  const handleToastClose = async () => {
    const wasSuccess = toast?.type === "success";
    setToast(null);
    // Redirect to home if it was a success toast
    if (wasSuccess) {
      // Ensure auth state is updated before redirect
      await refetch();
      // Dispatch event one more time to ensure all components are updated
      window.dispatchEvent(new Event("auth-state-changed"));
      // Small delay to ensure state propagates to all components
      setTimeout(() => {
        router.push("/");
      }, 200);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--coffee-brown-very-light)] to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {mode === "signup" ? (
          <SignUpForm
            onSuccess={handleSuccess}
            onError={handleError}
            switchToSignIn={() => setMode("signin")}
          />
        ) : mode === "forgot-password" ? (
          <ForgotPasswordForm
            onSuccess={(data) => {
              setToast({
                message: data?.message || "Password reset successfully! You can now sign in with your new password.",
                type: "success",
                position: "center",
                autoClose: false,
              });
              // After showing success, switch to sign in
              setTimeout(() => {
                setMode("signin");
              }, 2000);
            }}
            onError={handleError}
            switchToSignIn={() => setMode("signin")}
          />
        ) : (
          <SignInForm
            onSuccess={handleSuccess}
            onError={handleError}
            switchToSignUp={() => setMode("signup")}
            switchToForgotPassword={() => setMode("forgot-password")}
          />
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={handleToastClose}
          position={toast.position || "top-right"}
          actionButton={toast.actionButton}
          autoClose={toast.autoClose !== undefined ? toast.autoClose : true}
        />
      )}
    </div>
  );
}

