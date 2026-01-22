"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";

export default function ForgotPasswordForm({ onSuccess, onError, switchToSignIn }) {
  // Step management: 'email' -> 'code' -> 'password'
  const [step, setStep] = useState("email");
  const [verifiedEmail, setVerifiedEmail] = useState("");

  // Animation state
  const [forgotPasswordAnimation, setForgotPasswordAnimation] = useState(null);
  const [passwordAnimation, setPasswordAnimation] = useState(null);

  // Email verification state
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  // Password reset state
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Load animations
  useEffect(() => {
    // Load ForgotPassword animation
    fetch("/animations/ForgotPassword.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        try {
          const data = JSON.parse(text);
          setForgotPasswordAnimation(data);
        } catch (parseError) {
          console.error("Failed to parse ForgotPassword Lottie JSON:", parseError);
        }
      })
      .catch((err) => console.error("Failed to load ForgotPassword Lottie animation:", err));

    // Load Password animation
    fetch("/animations/Password.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        try {
          const data = JSON.parse(text);
          setPasswordAnimation(data);
        } catch (parseError) {
          console.error("Failed to parse Password Lottie JSON:", parseError);
        }
      })
      .catch((err) => console.error("Failed to load Password Lottie animation:", err));
  }, []);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[a-zA-Z]/.test(password)) {
      return "Password must contain at least one letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    return null;
  };

  // Step 1: Send reset code
  const handleSendCode = async (e) => {
    e?.preventDefault();
    setVerificationError("");

    if (!email.trim()) {
      setVerificationError("Email is required");
      return;
    }

    if (!validateEmail(email)) {
      setVerificationError("Invalid email format");
      return;
    }

    setSendingCode(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/auth/forgot-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: email.trim() }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reset code");
      }

      setCodeSent(true);
      setStep("code");
      setVerificationError("");
    } catch (error) {
      console.error("Send code error:", error);
      setVerificationError(error.message || "Failed to send reset code");
    } finally {
      setSendingCode(false);
    }
  };

  // Step 2: Verify code
  const handleVerifyCode = async (e) => {
    e?.preventDefault();
    setVerificationError("");

    if (!verificationCode.trim()) {
      setVerificationError("Verification code is required");
      return;
    }

    if (verificationCode.trim().length !== 6) {
      setVerificationError("Verification code must be 6 digits");
      return;
    }

    setVerifyingCode(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/auth/verify-reset-code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            code: verificationCode.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid verification code");
      }

      // Code verified, proceed to password reset
      setVerifiedEmail(email.trim());
      setStep("password");
      setVerificationError("");
    } catch (error) {
      console.error("Verify code error:", error);
      setVerificationError(error.message || "Invalid verification code");
    } finally {
      setVerifyingCode(false);
    }
  };

  // Step 3: Reset password validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.newPassword) {
      newErrors.newPassword = "New password is required";
    } else {
      const passwordError = validatePassword(formData.newPassword);
      if (passwordError) {
        newErrors.newPassword = passwordError;
      }
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 3: Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/auth/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: verifiedEmail,
            code: verificationCode.trim(),
            newPassword: formData.newPassword,
            confirmPassword: formData.confirmPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorInfo = {
          message: data.error || "Failed to reset password",
          status: response.status,
        };
        throw errorInfo;
      }

      // Password reset successful
      onSuccess?.({ message: "Password reset successfully! You can now sign in with your new password." });
    } catch (error) {
      console.error("Reset password error:", error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, ""); // Only allow digits
    if (value.length <= 6) {
      setVerificationCode(value);
      setVerificationError("");
    }
  };

  const handleResendCode = () => {
    setCodeSent(false);
    setVerificationCode("");
    setStep("email");
    handleSendCode();
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Animation */}
      <div className="mb-6 flex justify-center">
        {step === "email" && forgotPasswordAnimation ? (
          <div className="h-32 w-32">
            <Lottie
              animationData={forgotPasswordAnimation}
              loop={true}
              autoplay={true}
              className="h-full w-full"
            />
          </div>
        ) : step === "password" && passwordAnimation ? (
          <div className="h-32 w-32">
            <Lottie
              animationData={passwordAnimation}
              loop={true}
              autoplay={true}
              className="h-full w-full"
            />
          </div>
        ) : (
          <div className="h-32 w-32 flex items-center justify-center text-6xl">
            {step === "email" ? "🔑" : step === "code" ? "📧" : "🔒"}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Enter Email */}
        {step === "email" && (
          <motion.div
            key="email"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="mb-6 text-3xl font-bold text-center text-[var(--coffee-brown)]">
              Forgot Password
            </h2>
            <p className="mb-6 text-center text-gray-600">
              Enter your email address and we'll send you a code to reset your password
            </p>

            <form onSubmit={handleSendCode}>
              <div className="mb-4">
                <label
                  htmlFor="email"
                  className="block mb-2 text-sm font-medium text-[var(--coffee-brown)]"
                >
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setVerificationError("");
                  }}
                  className={`w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ${
                    verificationError
                      ? "border-red-500 focus:ring-red-500"
                      : "border-[var(--coffee-brown-light)] focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                  }`}
                  placeholder="your.email@example.com"
                  required
                  autoFocus
                />
                {verificationError && (
                  <p className="mt-1 text-sm text-red-500">{verificationError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={sendingCode}
                className="w-full rounded-lg bg-[var(--lime-green)] px-6 py-3 text-white font-semibold transition-all hover:bg-[var(--lime-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingCode ? "Sending Code..." : "Send Reset Code"}
              </button>
            </form>
          </motion.div>
        )}

        {/* Step 2: Enter Verification Code */}
        {step === "code" && (
          <motion.div
            key="code"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="mb-6 text-3xl font-bold text-center text-[var(--coffee-brown)]">
              Enter Verification Code
            </h2>
            <p className="mb-2 text-center text-gray-600">
              We sent a 6-digit code to
            </p>
            <p className="mb-4 text-center font-semibold text-[var(--coffee-brown)]">
              {email}
            </p>
            <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-sm text-blue-800 text-center">
                <span className="font-semibold">Can't find the email?</span> Please check your spam or junk folder. 
                If you still don't see it, you can request a new code below.
              </p>
            </div>

            <form onSubmit={handleVerifyCode}>
              <div className="mb-4">
                <label
                  htmlFor="verificationCode"
                  className="block mb-2 text-sm font-medium text-[var(--coffee-brown)]"
                >
                  Verification Code *
                </label>
                <input
                  type="text"
                  id="verificationCode"
                  name="verificationCode"
                  value={verificationCode}
                  onChange={handleCodeChange}
                  className={`w-full rounded-lg border px-4 py-2 text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 ${
                    verificationError
                      ? "border-red-500 focus:ring-red-500"
                      : "border-[var(--coffee-brown-light)] focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                  }`}
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                />
                {verificationError && (
                  <p className="mt-1 text-sm text-red-500">{verificationError}</p>
                )}
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Code expires in 10 minutes
                </p>
              </div>

              <button
                type="submit"
                disabled={verifyingCode || verificationCode.length !== 6}
                className="w-full rounded-lg bg-[var(--lime-green)] px-6 py-3 text-white font-semibold transition-all hover:bg-[var(--lime-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed mb-3"
              >
                {verifyingCode ? "Verifying..." : "Verify Code"}
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={sendingCode}
                className="w-full text-sm text-[var(--coffee-brown)] hover:text-[var(--lime-green)] transition-colors"
              >
                {sendingCode ? "Sending..." : "Resend Code"}
              </button>
            </form>
          </motion.div>
        )}

        {/* Step 3: Reset Password */}
        {step === "password" && (
          <motion.form
            key="password"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleResetPassword}
          >
            <h2 className="mb-2 text-3xl font-bold text-center text-[var(--coffee-brown)]">
              Reset Password
            </h2>
            <p className="mb-6 text-center text-sm text-gray-600">
              Email verified: <span className="font-semibold text-[var(--lime-green)]">{verifiedEmail}</span>
            </p>

            {/* New Password */}
            <div className="mb-4">
              <label
                htmlFor="newPassword"
                className="block mb-2 text-sm font-medium text-[var(--coffee-brown)]"
              >
                New Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleChange}
                  className={`w-full rounded-lg border px-4 py-2 pr-10 focus:outline-none focus:ring-2 ${
                    errors.newPassword
                      ? "border-red-500 focus:ring-red-500"
                      : "border-[var(--coffee-brown-light)] focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                  }`}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[var(--coffee-brown)] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="mt-1 text-sm text-red-500">{errors.newPassword}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Must be at least 8 characters with one letter and one number
              </p>
            </div>

            {/* Confirm Password */}
            <div className="mb-6">
              <label
                htmlFor="confirmPassword"
                className="block mb-2 text-sm font-medium text-[var(--coffee-brown)]"
              >
                Confirm New Password *
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={`w-full rounded-lg border px-4 py-2 pr-10 focus:outline-none focus:ring-2 ${
                    errors.confirmPassword
                      ? "border-red-500 focus:ring-red-500"
                      : "border-[var(--coffee-brown-light)] focus:border-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[var(--coffee-brown)] transition-colors"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--lime-green)] px-6 py-3 text-white font-semibold transition-all hover:bg-[var(--lime-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Resetting Password..." : "Reset Password"}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Back to Sign In */}
      <p className="mt-4 text-center text-sm text-[var(--coffee-brown)]">
        Remember your password?{" "}
        <button
          type="button"
          onClick={switchToSignIn}
          className="font-semibold text-[var(--lime-green)] hover:text-[var(--lime-green-dark)] transition-colors"
        >
          Sign In
        </button>
      </p>
    </div>
  );
}

