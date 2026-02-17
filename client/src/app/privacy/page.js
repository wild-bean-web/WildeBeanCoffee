"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-lg bg-white p-8 shadow-md"
        >
          <h1 className="mb-4 text-4xl font-bold text-[var(--coffee-brown)]">
            Privacy Policy
          </h1>
          <p className="mb-8 text-sm text-gray-600">
            Last updated: {currentDate}
          </p>

          <div className="prose prose-lg max-w-none space-y-8 text-gray-700">
            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                1. Introduction
              </h2>
              <p className="mb-4 leading-relaxed">
                Welcome to Wild Bean Coffee ("we," "our," or "us"). We are
                committed to protecting your privacy and ensuring the security
                of your personal information. This Privacy Policy explains how
                we collect, use, disclose, and safeguard your information when
                you visit our website and use our online ordering services.
              </p>
              <p className="leading-relaxed">
                By using our website, you agree to the collection and use of
                information in accordance with this policy. If you do not agree
                with our policies and practices, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                2. Information We Collect
              </h2>
              <h3 className="mb-3 text-xl font-semibold text-[var(--coffee-brown)]">
                2.1 Information You Provide
              </h3>
              <p className="mb-4 leading-relaxed">
                We collect information that you voluntarily provide to us when
                you:
              </p>
              <ul className="mb-4 ml-6 list-disc space-y-2">
                <li>
                  Create an account: name, email address, phone number, and
                  password
                </li>
                <li>
                  Place an order: name, phone number, email address (optional),
                  pickup time preferences, and special instructions
                </li>
                <li>
                  Contact us: any information you provide when reaching out to
                  us
                </li>
              </ul>

              <h3 className="mb-3 text-xl font-semibold text-[var(--coffee-brown)]">
                2.2 Automatically Collected Information
              </h3>
              <p className="mb-4 leading-relaxed">
                When you visit our website, we automatically collect certain
                information about your device and browsing behavior, including:
              </p>
              <ul className="mb-4 ml-6 list-disc space-y-2">
                <li>IP address</li>
                <li>Browser type and version</li>
                <li>Pages you visit on our website</li>
                <li>Time and date of your visit</li>
                <li>Time spent on pages</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                3. How We Use Your Information
              </h2>
              <p className="mb-4 leading-relaxed">
                We use the information we collect for the following purposes:
              </p>
              <ul className="mb-4 ml-6 list-disc space-y-2">
                <li>
                  <strong>Order Processing:</strong> To process and fulfill your
                  orders, including sending order confirmations and updates
                </li>
                <li>
                  <strong>Account Management:</strong> To create and manage your
                  account, authenticate your identity, and provide access to
                  your order history
                </li>
                <li>
                  <strong>Communication:</strong> To communicate with you about
                  your orders, respond to your inquiries, and send important
                  updates about our services
                </li>
                <li>
                  <strong>Website Functionality:</strong> To maintain your
                  shopping cart, remember your preferences, and improve your user
                  experience
                </li>
                <li>
                  <strong>Legal Compliance:</strong> To comply with applicable
                  laws, regulations, and legal processes
                </li>
                <li>
                  <strong>Security:</strong> To protect against fraud, abuse,
                  and unauthorized access to our systems
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                4. Cookies and Local Storage
              </h2>
              <p className="mb-4 leading-relaxed">
                We use cookies and local storage technologies to enhance your
                experience on our website. Here's what you need to know:
              </p>

              <h3 className="mb-3 text-xl font-semibold text-[var(--coffee-brown)]">
                4.1 What Are Cookies?
              </h3>
              <p className="mb-4 leading-relaxed">
                Cookies are small text files that are placed on your device when
                you visit a website. They help websites remember your actions and
                preferences over a period of time.
              </p>

              <h3 className="mb-3 text-xl font-semibold text-[var(--coffee-brown)]">
                4.2 Types of Cookies We Use
              </h3>
              <div className="mb-4 rounded-lg bg-gray-50 p-4">
                <h4 className="mb-2 font-semibold text-[var(--coffee-brown)]">
                  Essential Cookies (Required)
                </h4>
                <p className="mb-3 text-sm leading-relaxed">
                  These cookies are necessary for the website to function
                  properly and cannot be disabled:
                </p>
                <ul className="ml-6 list-disc space-y-1 text-sm">
                  <li>
                    <strong>Authentication Cookies:</strong> We use secure,
                    httpOnly cookies to maintain your login session. These
                    cookies are essential for keeping you logged in and
                    protecting your account. They expire after 7 days of
                    inactivity.
                  </li>
                  <li>
                    <strong>Shopping Cart Storage:</strong> We use browser local
                    storage to remember items in your shopping cart. This
                    allows you to add items to your cart and continue shopping
                    without losing your selections.
                  </li>
                </ul>
              </div>

              <h3 className="mb-3 text-xl font-semibold text-[var(--coffee-brown)]">
                4.3 Managing Cookies
              </h3>
              <p className="mb-4 leading-relaxed">
                Most web browsers automatically accept cookies, but you can
                usually modify your browser settings to decline cookies if you
                prefer. However, please note that disabling essential cookies
                may prevent you from using certain features of our website,
                including:
              </p>
              <ul className="mb-4 ml-6 list-disc space-y-2">
                <li>Staying logged into your account</li>
                <li>Maintaining items in your shopping cart</li>
                <li>Placing orders online</li>
              </ul>
              <p className="leading-relaxed">
                To manage cookies in your browser, please refer to your browser's
                help documentation.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                5. Third-Party Services
              </h2>
              <p className="mb-4 leading-relaxed">
                We use third-party services to provide certain features of our
                website:
              </p>

              <h3 className="mb-3 text-xl font-semibold text-[var(--coffee-brown)]">
                5.1 Payment Processing
              </h3>
              <p className="mb-4 leading-relaxed">
                We use Clover, a secure payment processing service, to handle
                all online payments. When you make a payment:
              </p>
              <ul className="mb-4 ml-6 list-disc space-y-2">
                <li>
                  Your payment information is processed securely through Clover's
                  payment system
                </li>
                <li>
                  We do not store your full credit card information on our
                  servers
                </li>
                <li>
                  Clover may use cookies and other technologies to process your
                  payment securely
                </li>
                <li>
                  Please review{" "}
                  <a
                    href="https://www.clover.com/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--lime-green)] hover:underline"
                  >
                    Clover's Privacy Policy
                  </a>{" "}
                  for information about how they handle your payment data
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                6. Data Security
              </h2>
              <p className="mb-4 leading-relaxed">
                We implement appropriate technical and organizational security
                measures to protect your personal information against
                unauthorized access, alteration, disclosure, or destruction.
                These measures include:
              </p>
              <ul className="mb-4 ml-6 list-disc space-y-2">
                <li>Encryption of sensitive data in transit (HTTPS/SSL)</li>
                <li>Secure, httpOnly cookies for authentication</li>
                <li>Password hashing using industry-standard algorithms</li>
                <li>Regular security assessments and updates</li>
                <li>Limited access to personal information on a need-to-know basis</li>
              </ul>
              <p className="leading-relaxed">
                However, no method of transmission over the Internet or
                electronic storage is 100% secure. While we strive to use
                commercially acceptable means to protect your information, we
                cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                7. Data Retention
              </h2>
              <p className="mb-4 leading-relaxed">
                We retain your personal information for as long as necessary to:
              </p>
              <ul className="mb-4 ml-6 list-disc space-y-2">
                <li>Fulfill the purposes outlined in this Privacy Policy</li>
                <li>Comply with legal obligations</li>
                <li>Resolve disputes and enforce our agreements</li>
              </ul>
              <p className="leading-relaxed">
                When you delete your account, we will delete or anonymize your
                personal information, except where we are required to retain it
                for legal purposes.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                8. Your Rights
              </h2>
              <p className="mb-4 leading-relaxed">
                Depending on your location, you may have certain rights regarding
                your personal information, including:
              </p>
              <ul className="mb-4 ml-6 list-disc space-y-2">
                <li>
                  <strong>Access:</strong> Request access to the personal
                  information we hold about you
                </li>
                <li>
                  <strong>Correction:</strong> Request correction of inaccurate
                  or incomplete information
                </li>
                <li>
                  <strong>Deletion:</strong> Request deletion of your personal
                  information
                </li>
                <li>
                  <strong>Objection:</strong> Object to processing of your
                  personal information
                </li>
                <li>
                  <strong>Data Portability:</strong> Request transfer of your
                  data to another service
                </li>
              </ul>
              <p className="leading-relaxed">
                To exercise these rights, please contact us using the information
                provided in the "Contact Us" section below.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                9. Children's Privacy
              </h2>
              <p className="mb-4 leading-relaxed">
                Our website is not intended for children under the age of 13. We
                do not knowingly collect personal information from children
                under 13. If you are a parent or guardian and believe your child
                has provided us with personal information, please contact us
                immediately so we can delete such information.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                10. Changes to This Privacy Policy
              </h2>
              <p className="mb-4 leading-relaxed">
                We may update this Privacy Policy from time to time. We will
                notify you of any changes by posting the new Privacy Policy on
                this page and updating the "Last updated" date. You are advised
                to review this Privacy Policy periodically for any changes.
              </p>
              <p className="leading-relaxed">
                Changes to this Privacy Policy are effective when they are posted
                on this page.
              </p>
            </section>

            <section>
              <h2 className="mb-4 text-2xl font-semibold text-[var(--coffee-brown)]">
                11. Contact Us
              </h2>
              <p className="mb-4 leading-relaxed">
                If you have any questions, concerns, or requests regarding this
                Privacy Policy or our data practices, please contact us:
              </p>
              <div className="mb-4 rounded-lg bg-gray-50 p-4">
                <p className="mb-2">
                  <strong>Wild Bean Coffee</strong>
                </p>
                <p className="mb-2">
                  Email:{" "}
                  <a
                    href="mailto:wildbeancoffeellc@gmail.com"
                    className="text-[var(--lime-green)] hover:underline"
                  >
                    wildbeancoffeellc@gmail.com
                  </a>
                </p>
                <p className="mb-2">
                  Phone:{" "}
                  <a
                    href="tel:+12406456203"
                    className="text-[var(--lime-green)] hover:underline"
                  >
                    +1 240-645-6203
                  </a>
                </p>
                <p className="mb-2">
                  Visit our{" "}
                  <Link
                    href="/location"
                    className="text-[var(--lime-green)] hover:underline"
                  >
                    Location & Hours
                  </Link>{" "}
                  page for our address and hours.
                </p>
                <p className="text-sm text-gray-600">
                  For privacy-related inquiries, please contact us by email or
                  phone, or visit us in-store.
                </p>
              </div>
            </section>

            <section className="border-t border-gray-200 pt-8">
              <p className="text-sm text-gray-600">
                By using our website and services, you acknowledge that you have
                read and understood this Privacy Policy.
              </p>
            </section>
          </div>

          <div className="mt-8 flex justify-center">
            <Link
              href="/"
              className="rounded-full bg-[var(--lime-green)] px-6 py-3 text-white font-semibold transition-colors hover:bg-[var(--lime-green-dark)]"
            >
              Return to Home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

