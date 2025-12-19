"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Lottie from "lottie-react";
import { SOCIAL_MEDIA_LINKS } from "@/lib/socialMediaLinks";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [instagramAnimation, setInstagramAnimation] = useState(null);
  const [facebookAnimation, setFacebookAnimation] = useState(null);
  const [tiktokAnimation, setTiktokAnimation] = useState(null);

  // Load Lottie animations
  useEffect(() => {
    // Load Instagram animation
    fetch("/animations/Instagram.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        try {
          const data = JSON.parse(text);
          setInstagramAnimation(data);
        } catch (parseError) {
          console.error("Failed to parse Instagram Lottie JSON:", parseError);
        }
      })
      .catch((err) => console.error("Failed to load Instagram Lottie animation:", err));

    // Load Facebook animation
    fetch("/animations/Facebook.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        try {
          const data = JSON.parse(text);
          setFacebookAnimation(data);
        } catch (parseError) {
          console.error("Failed to parse Facebook Lottie JSON:", parseError);
        }
      })
      .catch((err) => console.error("Failed to load Facebook Lottie animation:", err));

    // Load TikTok animation
    fetch("/animations/Tiktok.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        try {
          const data = JSON.parse(text);
          setTiktokAnimation(data);
        } catch (parseError) {
          console.error("Failed to parse TikTok Lottie JSON:", parseError);
        }
      })
      .catch((err) => console.error("Failed to load TikTok Lottie animation:", err));
  }, []);

  return (
    <footer className="bg-[var(--coffee-brown-dark)] text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="mb-4 text-lg font-semibold">Wild Bean Coffee</h3>
            <p className="text-sm text-gray-300">
              Fresh roasted coffee beans and handcrafted beverages. Visit us in
              store or order online for pickup.
            </p>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-semibold">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/shop"
                  className="text-gray-300 transition-colors hover:text-[var(--lime-green)]"
                >
                  Shop Coffee Beans
                </Link>
              </li>
              <li>
                <Link
                  href="/menu"
                  className="text-gray-300 transition-colors hover:text-[var(--lime-green)]"
                >
                  Menu
                </Link>
              </li>
              <li>
                <Link
                  href="/location"
                  className="text-gray-300 transition-colors hover:text-[var(--lime-green)]"
                >
                  Location & Hours
                </Link>
              </li>
              <li>
                <Link
                  href="/order"
                  className="text-gray-300 transition-colors hover:text-[var(--lime-green)]"
                >
                  Order Online
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-semibold">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-gray-300 transition-colors hover:text-[var(--lime-green)]"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-semibold">Contact</h3>
            <p className="mb-4 text-sm text-gray-300">
              Visit our location page for address, hours, and contact
              information.
            </p>
            {/* Social Media Icons */}
            <div className="flex items-center gap-4">
              <motion.a
                href={SOCIAL_MEDIA_LINKS.instagram}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-[var(--lime-green-light)] p-2 transition-all hover:shadow-lg"
                aria-label="Follow us on Instagram"
              >
                {instagramAnimation ? (
                  <Lottie
                    animationData={instagramAnimation}
                    loop={true}
                    autoplay={true}
                    className="h-full w-full"
                  />
                ) : (
                  <span className="text-2xl">📷</span>
                )}
              </motion.a>
              <motion.a
                href={SOCIAL_MEDIA_LINKS.facebook}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-[var(--lime-green-light)] p-2 transition-all hover:shadow-lg"
                aria-label="Follow us on Facebook"
              >
                {facebookAnimation ? (
                  <Lottie
                    animationData={facebookAnimation}
                    loop={true}
                    autoplay={true}
                    className="h-full w-full"
                  />
                ) : (
                  <span className="text-2xl">👤</span>
                )}
              </motion.a>
              <motion.a
                href={SOCIAL_MEDIA_LINKS.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-[var(--lime-green-light)] p-2 transition-all hover:shadow-lg"
                aria-label="Follow us on TikTok"
              >
                {tiktokAnimation ? (
                  <Lottie
                    animationData={tiktokAnimation}
                    loop={true}
                    autoplay={true}
                    className="h-full w-full"
                  />
                ) : (
                  <span className="text-2xl">🎵</span>
                )}
              </motion.a>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-700 pt-8 text-center text-sm text-gray-400">
          <p>&copy; {currentYear} Wild Bean Coffee. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

