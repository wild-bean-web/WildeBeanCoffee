import express from "express";
import { EmailVerification } from "../models/index.js";
import { sendVerificationCode, verifyEmailConfig } from "../services/email.js";
import { isValidEmail, errorResponse } from "../utils/validation.js";
import crypto from "crypto";

const router = express.Router();

/**
 * GET /api/email-verification/test
 * Test email configuration
 */
router.get("/test", async (req, res) => {
  try {
    const isConfigured = await verifyEmailConfig();
    if (isConfigured) {
      return res.json({
        success: true,
        message: "Email service is configured correctly",
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Email service is not configured correctly",
      });
    }
  } catch (error) {
    console.error("Email config test error:", error);
    return errorResponse(res, 500, "Failed to test email configuration", error.message);
  }
});

/**
 * POST /api/email-verification/send
 * Send verification code to email
 */
router.post("/send", async (req, res) => {
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

    // Check if user already exists (prevent duplicate signups)
    const { User } = await import("../models/index.js");
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return errorResponse(res, 409, "Email already registered");
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();

    // Set expiration (10 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Delete any existing unverified codes for this email
    await EmailVerification.deleteMany({
      email: normalizedEmail,
      verified: false,
    });

    // Create new verification record
    const verification = new EmailVerification({
      email: normalizedEmail,
      code,
      expiresAt,
      verified: false,
    });

    await verification.save();

    // Send email
    try {
      const emailResult = await sendVerificationCode(normalizedEmail, code);
      console.log("✅ Email sent successfully:", emailResult.messageId);
    } catch (emailError) {
      // Log the full error for debugging
      console.error("❌ Failed to send verification email:", emailError);
      console.error("   Error details:", emailError.message);
      // For development, return the code so testing can continue
      if (process.env.NODE_ENV === "development") {
        console.log(`[DEV] Verification code for ${normalizedEmail}: ${code}`);
        // Still return success in dev mode so testing can continue
        return res.json({
          success: true,
          message: "Verification code generated (email failed, see console)",
          devCode: code,
          warning: "Email sending failed. Check server logs for details.",
        });
      }
      // In production, return error
      return errorResponse(res, 500, "Failed to send verification email", emailError.message);
    }

    return res.json({
      success: true,
      message: "Verification code sent to email",
      // In development, you might want to return the code for testing
      ...(process.env.NODE_ENV === "development" && { devCode: code }),
    });
  } catch (error) {
    console.error("Send verification code error:", error);
    return errorResponse(res, 500, "Failed to send verification code", error.message);
  }
});

/**
 * POST /api/email-verification/verify
 * Verify the code entered by user
 */
router.post("/verify", async (req, res) => {
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

    // Find verification record
    const verification = await EmailVerification.findOne({
      email: normalizedEmail,
      code: normalizedCode,
      verified: false,
    });

    if (!verification) {
      return errorResponse(res, 400, "Invalid or expired verification code");
    }

    // Check if code has expired
    if (new Date() > verification.expiresAt) {
      await EmailVerification.deleteOne({ _id: verification._id });
      return errorResponse(res, 400, "Verification code has expired");
    }

    // Mark as verified
    verification.verified = true;
    await verification.save();

    return res.json({
      success: true,
      message: "Email verified successfully",
      data: {
        email: normalizedEmail,
        verified: true,
      },
    });
  } catch (error) {
    console.error("Verify code error:", error);
    return errorResponse(res, 500, "Failed to verify code", error.message);
  }
});

export default router;

