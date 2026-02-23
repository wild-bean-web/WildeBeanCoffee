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
    <footer className="w-full max-w-full overflow-x-hidden bg-[var(--coffee-brown-dark)] text-white">
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
              <li>
                <Link
                  href="/terms"
                  className="text-gray-300 transition-colors hover:text-[var(--lime-green)]"
                >
                  Terms of Use
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-semibold">Contact</h3>
            <p className="mb-2 text-sm text-gray-300">
              <a href="tel:+12406456203" className="transition-colors hover:text-[var(--lime-green)]">
                +1 240-645-6203
              </a>
            </p>
            <p className="mb-4 text-sm text-gray-300">
              <a href="mailto:wildbeancoffeellc@gmail.com" className="transition-colors hover:text-[var(--lime-green)]">
                wildbeancoffeellc@gmail.com
              </a>
            </p>
            <p className="mb-8 text-sm text-gray-300">
              <Link href="/location" className="transition-colors hover:text-[var(--lime-green)]">
                Location, hours & directions
              </Link>
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
        <div className="mt-8 border-t border-gray-700 pt-8 pb-[60px] text-center text-sm text-gray-400">
          <p className="mb-1">&copy; {currentYear} Wild Bean Coffee. All rights reserved.</p>
          <p className="text-xs text-gray-500">
            Menu and product images are for illustration only and may not represent actual items.
          </p>
        </div>
      </div>
    </footer>
  );
}

