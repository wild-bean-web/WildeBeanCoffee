import express from "express";
import { User, Order, EmailVerification, PasswordReset } from "../models/index.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { isValidEmail, validatePassword, errorResponse } from "../utils/validation.js";
import { authenticate, generateToken } from "../middleware/auth.js";
import { sendPasswordResetCode } from "../services/email.js";
import crypto from "crypto";

const router = express.Router();

/**
 * POST /api/auth/signup
 * Create a new user account
 */
router.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, phone } = req.body;
    const errors = [];

    // Validate required fields
    if (!firstName || !firstName.trim()) {
      errors.push("First name is required");
    }
    if (!lastName || !lastName.trim()) {
      errors.push("Last name is required");
    }
    if (!email || !email.trim()) {
      errors.push("Email is required");
    } else if (!isValidEmail(email)) {
      errors.push("Invalid email format");
    }
    if (!password) {
      errors.push("Password is required");
    } else {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        errors.push(passwordValidation.message);
      }
    }
    if (!confirmPassword) {
      errors.push("Please confirm your password");
    } else if (password !== confirmPassword) {
      errors.push("Passwords do not match");
    }
    if (!phone || !phone.trim()) {
      errors.push("Phone number is required");
    }

    if (errors.length > 0) {
      return errorResponse(res, 400, "Validation failed", errors);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return errorResponse(res, 409, "Email already registered");
    }

    // Verify that email has been verified
    const normalizedEmail = email.toLowerCase().trim();
    const emailVerification = await EmailVerification.findOne({
      email: normalizedEmail,
      verified: true,
    });

    if (!emailVerification) {
      return errorResponse(res, 403, "Email not verified. Please verify your email first.");
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone.trim(),
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id.toString());

    // Set cookie (optional, for httpOnly cookie support)
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return user data (without password) and token
    const userData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
    };

    return res.status(201).json({
      success: true,
      data: {
        user: userData,
        token,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return errorResponse(res, 500, "Failed to create account", error.message);
  }
});

/**
 * POST /api/auth/signin
 * Sign in with email and password
 */
router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    const errors = [];

    // Validate required fields
    if (!email || !email.trim()) {
      errors.push("Email is required");
    } else if (!isValidEmail(email)) {
      errors.push("Invalid email format");
    }
    if (!password) {
      errors.push("Password is required");
    }

    if (errors.length > 0) {
      return errorResponse(res, 400, "Validation failed", errors);
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return errorResponse(res, 404, "Email not found");
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return errorResponse(res, 401, "Invalid password");
    }

    // Generate token
    const token = generateToken(user._id.toString());

    // Set cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return user data (without password) and token
    const userData = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
    };

    return res.json({
      success: true,
      data: {
        user: userData,
        token,
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    return errorResponse(res, 500, "Failed to sign in", error.message);
  }
});

/**
 * POST /api/auth/signout
 * Sign out (invalidate session)
 */
router.post("/signout", authenticate, async (req, res) => {
  try {
    // Clear cookie
    res.clearCookie("token");
    
    return res.json({
      success: true,
      message: "Signed out successfully",
    });
  } catch (error) {
    console.error("Signout error:", error);
    return errorResponse(res, 500, "Failed to sign out", error.message);
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get("/me", authenticate, async (req, res) => {
  try {
    const userData = {
      _id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      phone: req.user.phone,
      createdAt: req.user.createdAt,
    };

    return res.json({
      success: true,
      data: {
        user: userData,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    return errorResponse(res, 500, "Failed to get user information", error.message);
  }
});

/**
 * GET /api/auth/orders
 * Get current user's orders
 */
router.get("/orders", authenticate, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find orders by userId (preferred) or by email (for backward compatibility)
    const orders = await Order.find({
      $or: [
        { userId: userId },
        { "customer.email": req.user.email },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50); // Limit to last 50 orders

    return res.json({
      success: true,
      data: {
        orders,
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    return errorResponse(res, 500, "Failed to get orders", error.message);
  }
});

/**
 * POST /api/auth/forgot-password
 * Send password reset code to user's email
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email || !email.trim()) {
      return errorResponse(res, 400, "Email is required");
    }

    if (!isValidEmail(email)) {
      return errorResponse(res, 400, "Invalid email format");
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Don't reveal if email exists or not (security best practice)
      // Return success even if user doesn't exist
      return res.json({
        success: true,
        message: "If an account exists with this email, a password reset code has been sent.",
      });
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();

    // Set expiration (10 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Delete any existing unverified codes for this email
    await PasswordReset.deleteMany({
      email: normalizedEmail,
      verified: false,
    });

    // Create new reset record
    const passwordReset = new PasswordReset({
      email: normalizedEmail,
      code,
      expiresAt,
      verified: false,
    });

    await passwordReset.save();

    // Send email
    try {
      await sendPasswordResetCode(normalizedEmail, code);
      console.log("✅ Password reset code sent successfully");
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
      // For development, return the code so testing can continue
      if (process.env.NODE_ENV === "development") {
        console.log(`[DEV] Password reset code for ${normalizedEmail}: ${code}`);
        return res.json({
          success: true,
          message: "Password reset code generated (email failed, see console)",
          devCode: code,
          warning: "Email sending failed. Check server logs for details.",
        });
      }
      return errorResponse(res, 500, "Failed to send password reset email", emailError.message);
    }

    return res.json({
      success: true,
      message: "If an account exists with this email, a password reset code has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return errorResponse(res, 500, "Failed to process password reset request", error.message);
  }
});

/**
 * POST /api/auth/verify-reset-code
 * Verify the password reset code
 */
router.post("/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    // Validate inputs
    if (!email || !email.trim()) {
      return errorResponse(res, 400, "Email is required");
    }

    if (!code || !code.trim()) {
      return errorResponse(res, 400, "Verification code is required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = code.trim();

    // Find reset record
    const passwordReset = await PasswordReset.findOne({
      email: normalizedEmail,
      code: normalizedCode,
      verified: false,
    });

    if (!passwordReset) {
      return errorResponse(res, 400, "Invalid or expired verification code");
    }

    // Check if code has expired
    if (new Date() > passwordReset.expiresAt) {
      await PasswordReset.deleteOne({ _id: passwordReset._id });
      return errorResponse(res, 400, "Verification code has expired");
    }

    // Mark as verified
    passwordReset.verified = true;
    await passwordReset.save();

    return res.json({
      success: true,
      message: "Verification code verified successfully",
      data: {
        email: normalizedEmail,
        verified: true,
      },
    });
  } catch (error) {
    console.error("Verify reset code error:", error);
    return errorResponse(res, 500, "Failed to verify code", error.message);
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password with new password
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword, confirmPassword } = req.body;
    const errors = [];

    // Validate inputs
    if (!email || !email.trim()) {
      errors.push("Email is required");
    } else if (!isValidEmail(email)) {
      errors.push("Invalid email format");
    }

    if (!code || !code.trim()) {
      errors.push("Verification code is required");
    }

    if (!newPassword) {
      errors.push("New password is required");
    } else {
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        errors.push(passwordValidation.message);
      }
    }

    if (!confirmPassword) {
      errors.push("Please confirm your password");
    } else if (newPassword !== confirmPassword) {
      errors.push("Passwords do not match");
    }

    if (errors.length > 0) {
      return errorResponse(res, 400, "Validation failed", errors);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = code.trim();

    // Verify that code has been verified
    const passwordReset = await PasswordReset.findOne({
      email: normalizedEmail,
      code: normalizedCode,
      verified: true,
    });

    if (!passwordReset) {
      return errorResponse(res, 400, "Invalid or unverified reset code. Please verify the code first.");
    }

    // Check if code has expired
    if (new Date() > passwordReset.expiresAt) {
      await PasswordReset.deleteOne({ _id: passwordReset._id });
      return errorResponse(res, 400, "Reset code has expired. Please request a new one.");
    }

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return errorResponse(res, 404, "User not found");
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user password
    user.password = hashedPassword;
    await user.save();

    // Delete the reset record (one-time use)
    await PasswordReset.deleteOne({ _id: passwordReset._id });

    return res.json({
      success: true,
      message: "Password reset successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return errorResponse(res, 500, "Failed to reset password", error.message);
  }
});

export default router;

