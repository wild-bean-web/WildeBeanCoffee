import nodemailer from "nodemailer";

/**
 * Create email transporter based on environment variables
 * Supports SMTP (Gmail, custom SMTP) or service-specific configs
 */
function createTransporter() {
  // Check if using Gmail OAuth2
  if (process.env.EMAIL_SERVICE === "gmail" && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log("✅ Using Gmail SMTP configuration");
    console.log("   EMAIL_USER:", process.env.EMAIL_USER);
    console.log("   EMAIL_FROM:", process.env.EMAIL_FROM || process.env.EMAIL_USER);
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Use App Password for Gmail
      },
    });
  }

  // Check if using custom SMTP
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // No config: caller must use getTransporterAsync() to create a real Ethereal test account
  return null;
}

// Lazy initialization - create transporter when first needed (sync path for configured email)
let transporter = null;
let testTransporterPromise = null;

function getTransporter() {
  if (!transporter) {
    console.log("📧 Creating email transporter...");
    console.log("   EMAIL_SERVICE:", process.env.EMAIL_SERVICE || "not set");
    console.log("   EMAIL_USER:", process.env.EMAIL_USER ? "Set" : "Not set");
    console.log("   EMAIL_PASS:", process.env.EMAIL_PASS ? "***" : "Not set");
    transporter = createTransporter();
  }
  return transporter;
}

/**
 * Get transporter, creating a real Ethereal test account when no email config is set.
 * Use this in send paths so verification emails actually send in development.
 */
async function getTransporterAsync() {
  const configured = getTransporter();
  if (configured) return configured;

  if (testTransporterPromise) return testTransporterPromise;
  console.warn(
    "⚠️  No email config (EMAIL_USER/EMAIL_PASS or SMTP_*). Creating Ethereal test account so emails can be sent in dev."
  );
  testTransporterPromise = nodemailer.createTestAccount().then((account) => {
    const t = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass },
    });
    transporter = t;
    console.log("📧 Ethereal test account ready. View sent emails at https://ethereal.email");
    return t;
  });
  return testTransporterPromise;
}

/**
 * Send verification code email
 * @param {string} email - Recipient email address
 * @param {string} code - 6-digit verification code
 * @returns {Promise<Object>} Email send result
 */
export async function sendVerificationCode(email, code) {
  // For Gmail, FROM address should match EMAIL_USER or be a verified alias
  // If EMAIL_FROM is different, Gmail will use EMAIL_USER as the sender
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@wildbeancoffee.com";
  
  const mailOptions = {
    from: `"Wild Bean Coffee" <${fromAddress}>`, // Add friendly name to improve deliverability
    to: email,
    subject: "Verify Your Email - Wild Bean Coffee",
    // Add headers to improve deliverability
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      "Importance": "high",
    },
    // Add reply-to for better email reputation
    replyTo: fromAddress,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #8B4513; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Wild Bean Coffee</h1>
          </div>
          <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #8B4513; margin-top: 0;">Verify Your Email Address</h2>
            <p>Thank you for signing up! Please use the verification code below to complete your registration:</p>
            <div style="background-color: white; border: 2px solid #8B4513; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #8B4513; font-family: monospace;">
                ${code}
              </div>
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Wild Bean Coffee. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `
      Wild Bean Coffee - Email Verification

      Thank you for signing up! Please use the verification code below to complete your registration:

      Verification Code: ${code}

      This code will expire in 10 minutes.

      If you didn't request this code, please ignore this email.

      © ${new Date().getFullYear()} Wild Bean Coffee. All rights reserved.
    `,
  };

  try {
    const transport = await getTransporterAsync();
    const info = await transport.sendMail(mailOptions);
    console.log("Verification email sent:", info.messageId);
    if (process.env.NODE_ENV === "development" && nodemailer.getTestMessageUrl) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log("Preview:", previewUrl);
    }
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}

/**
 * Send password reset code email
 * @param {string} email - Recipient email address
 * @param {string} code - 6-digit verification code
 * @returns {Promise<Object>} Email send result
 */
export async function sendPasswordResetCode(email, code) {
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@wildbeancoffee.com";
  
  const mailOptions = {
    from: `"Wild Bean Coffee" <${fromAddress}>`,
    to: email,
    subject: "Reset Your Password - Wild Bean Coffee",
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      "Importance": "high",
    },
    replyTo: fromAddress,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #8B4513; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Wild Bean Coffee</h1>
          </div>
          <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #8B4513; margin-top: 0;">Reset Your Password</h2>
            <p>We received a request to reset your password. Please use the verification code below to continue:</p>
            <div style="background-color: white; border: 2px solid #8B4513; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #8B4513; font-family: monospace;">
                ${code}
              </div>
            </div>
            <p style="color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Wild Bean Coffee. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `
      Wild Bean Coffee - Password Reset

      We received a request to reset your password. Please use the verification code below to continue:

      Verification Code: ${code}

      This code will expire in 10 minutes.

      If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

      © ${new Date().getFullYear()} Wild Bean Coffee. All rights reserved.
    `,
  };

  try {
    const transport = await getTransporterAsync();
    const info = await transport.sendMail(mailOptions);
    console.log("Password reset email sent:", info.messageId);
    if (process.env.NODE_ENV === "development" && nodemailer.getTestMessageUrl) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log("Preview:", previewUrl);
    }
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
}

/**
 * Verify email transporter configuration
 * @returns {Promise<boolean>} True if email service is configured
 */
export async function verifyEmailConfig() {
  try {
    const transport = await getTransporterAsync();
    await transport.verify();
    return true;
  } catch (error) {
    console.error("Email configuration error:", error);
    return false;
  }
}

