"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Lottie from "lottie-react";
import { SOCIAL_MEDIA_LINKS } from "@/lib/socialMediaLinks";

export default function SocialMediaGallery() {
  const [instagramAnimation, setInstagramAnimation] = useState(null);
  const [facebookAnimation, setFacebookAnimation] = useState(null);
  const [tiktokAnimation, setTiktokAnimation] = useState(null);
  const [selfieAnimation, setSelfieAnimation] = useState(null);
  const [espressoSelfieAnimation, setEspressoSelfieAnimation] = useState(null);

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
      .catch((err) =>
        console.error("Failed to load Instagram Lottie animation:", err)
      );

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
      .catch((err) =>
        console.error("Failed to load Facebook Lottie animation:", err)
      );

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
      .catch((err) =>
        console.error("Failed to load TikTok Lottie animation:", err)
      );

    // Load Selfie animation
    fetch("/animations/Selfie.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        try {
          const data = JSON.parse(text);
          setSelfieAnimation(data);
        } catch (parseError) {
          console.error("Failed to parse Selfie Lottie JSON:", parseError);
        }
      })
      .catch((err) =>
        console.error("Failed to load Selfie Lottie animation:", err)
      );

    // Load EspressoSelfie animation
    fetch("/animations/esspressoSelfie.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        try {
          const data = JSON.parse(text);
          setEspressoSelfieAnimation(data);
        } catch (parseError) {
          console.error(
            "Failed to parse esspressoSelfie Lottie JSON:",
            parseError
          );
        }
      })
      .catch((err) =>
        console.error("Failed to load esspressoSelfie Lottie animation:", err)
      );
  }, []);

  // Sample gallery images - replace with your actual Instagram/Facebook images
  const galleryImages = [
    {
      id: 1,
      src: "/images/menu/Coffee/Latte.png",
      alt: "Coffee",
      platform: "instagram",
      link: SOCIAL_MEDIA_LINKS.instagram,
    },
    {
      id: 2,
      src: "/images/menu/Oatmeals/WildVegan.png",
      alt: "Wild Vegan bowl",
      platform: "instagram",
      link: SOCIAL_MEDIA_LINKS.instagram,
    },
    {
      id: 3,
      src: "/images/menu/Bakery/PlainCroissant.png",
      alt: "Plain croissant",
      platform: "facebook",
      link: SOCIAL_MEDIA_LINKS.facebook,
      title: "Sip. Snap. Share",
      text: "Made for mornings. Perfect for your feed.",
      animation: "selfie",
    },
    {
      id: 4,
      src: "/images/menu/Smoothies/TropicalBlissLand.png",
      alt: "Smoothie",
      platform: "instagram",
      link: SOCIAL_MEDIA_LINKS.instagram,
    },
    {
      id: 5,
      src: "/images/menu/Favorites/IcedMatchaLatteLand.png",
      alt: "Iced Matcha Latte",
      platform: "facebook",
      link: SOCIAL_MEDIA_LINKS.facebook,
    },
    {
      id: 6,
      src: "/images/menu/Coffee/EspressoMacchiatoLand.png",
      alt: "Chai Latte",
      platform: "Espresso Macchiato",
      link: SOCIAL_MEDIA_LINKS.instagram,
      title: "Tag @wildbeancoffeellc",
      text: "Espresso yourself… we won't judge",
      animation: "espressoSelfie",
    },
    {
      id: 7,
      src: "/images/menu/Smoothies/BerryBoostLand.png",
      alt: "Smoothie",
      platform: "instagram",
      link: SOCIAL_MEDIA_LINKS.instagram,
    },
    {
      id: 8,
      src: "/images/menu/Bakery/ChocolateCroissant.png",
      alt: "Chocolate croissant",
      platform: "facebook",
      link: SOCIAL_MEDIA_LINKS.facebook,
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <section className="bg-gradient-to-b from-gray-50 to-white py-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center"
        >
          <h2 className="mb-4 text-4xl font-bold text-[var(--coffee-brown)] sm:text-5xl">
            Follow Us
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            Join our community and see what's brewing at Wild Bean Coffee
          </p>

          {/* Social Media Links */}
          <div className="mt-8 flex items-center justify-center gap-8">
            <motion.a
              href={SOCIAL_MEDIA_LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
              className="group relative flex h-24 w-24 items-center justify-center transition-all"
            >
              {instagramAnimation ? (
                <Lottie
                  animationData={instagramAnimation}
                  loop={true}
                  autoplay={true}
                  className="h-full w-full"
                />
              ) : (
                <div className="text-5xl">📷</div>
              )}
            </motion.a>

            <motion.a
              href={SOCIAL_MEDIA_LINKS.facebook}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
              className="group relative flex h-24 w-24 items-center justify-center transition-all"
            >
              {facebookAnimation ? (
                <Lottie
                  animationData={facebookAnimation}
                  loop={true}
                  autoplay={true}
                  className="h-full w-full"
                />
              ) : (
                <div className="text-5xl">👤</div>
              )}
            </motion.a>

            <motion.a
              href={SOCIAL_MEDIA_LINKS.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
              className="group relative flex h-24 w-24 items-center justify-center transition-all"
            >
              {tiktokAnimation ? (
                <Lottie
                  animationData={tiktokAnimation}
                  loop={true}
                  autoplay={true}
                  className="h-full w-full"
                />
              ) : (
                <div className="text-5xl">🎵</div>
              )}
            </motion.a>
          </div>
        </motion.div>

        {/* Gallery Grid - Modern Masonry Style */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
        >
          {galleryImages.map((image, index) => {
            // Determine if this is a shorter image (4/3 aspect ratio)
            const isShortImage = index % 3 === 2;
            const aspectRatio =
              index % 3 === 0 ? "4/5" : index % 3 === 1 ? "3/4" : "4/3";

            return (
              <motion.div
                key={image.id}
                variants={itemVariants}
                className={`group overflow-hidden rounded-lg transition-all duration-300 ${
                  isShortImage
                    ? "flex flex-col bg-white shadow-md hover:shadow-2xl"
                    : "bg-white"
                }`}
              >
                <a
                  href={image.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`relative block w-full overflow-hidden ${
                    isShortImage ? "rounded-t-lg" : "rounded-lg"
                  }`}
                  style={{
                    aspectRatio: aspectRatio,
                    maxHeight: "392px",
                  }}
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    unoptimized
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                  />

                  {/* Overlay with platform icon */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="absolute bottom-4 right-4">
                      {image.platform === "instagram" && instagramAnimation ? (
                        <div className="h-8 w-8 rounded-full bg-white/90 p-1">
                          <Lottie
                            animationData={instagramAnimation}
                            loop={true}
                            autoplay={true}
                            className="h-full w-full"
                          />
                        </div>
                      ) : image.platform === "facebook" && facebookAnimation ? (
                        <div className="h-8 w-8 rounded-full bg-white/90 p-1">
                          <Lottie
                            animationData={facebookAnimation}
                            loop={true}
                            autoplay={true}
                            className="h-full w-full"
                          />
                        </div>
                      ) : image.platform === "tiktok" && tiktokAnimation ? (
                        <div className="h-8 w-8 rounded-full bg-white/90 p-1">
                          <Lottie
                            animationData={tiktokAnimation}
                            loop={true}
                            autoplay={true}
                            className="h-full w-full"
                          />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-xs">
                          {image.platform === "instagram"
                            ? "📷"
                            : image.platform === "facebook"
                              ? "👤"
                              : "🎵"}
                        </div>
                      )}
                    </div>
                  </div>
                </a>

                {/* Text area for shorter images */}
                {isShortImage && (
                  <div className="flex w-full flex-col justify-center bg-white p-3 sm:p-4">
                    {image.title && image.text ? (
                      <>
                        {/* Animation if specified */}
                        {image.animation === "selfie" && selfieAnimation && (
                          <div className="mb-2 flex justify-center">
                            <div className="h-16 w-16 sm:h-20 sm:w-20">
                              <Lottie
                                animationData={selfieAnimation}
                                loop={true}
                                autoplay={true}
                                className="h-full w-full"
                              />
                            </div>
                          </div>
                        )}
                        {image.animation === "espressoSelfie" &&
                          espressoSelfieAnimation && (
                            <div className="mb-2 flex justify-center">
                              <div className="h-16 w-16 sm:h-20 sm:w-20">
                                <Lottie
                                  animationData={espressoSelfieAnimation}
                                  loop={true}
                                  autoplay={true}
                                  className="h-full w-full"
                                />
                              </div>
                            </div>
                          )}
                        <h3 className="mb-1 text-center text-xs font-extrabold text-gray-800 sm:text-sm">
                          {image.title}
                        </h3>
                        <p className="text-center text-[10px] font-semibold leading-tight text-gray-600 sm:text-xs">
                          {image.text}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-medium text-gray-800">
                          {image.alt}
                        </p>
                        <p className="mt-1 text-[10px] text-gray-500">
                          Follow us on{" "}
                          {image.platform === "instagram"
                            ? "Instagram"
                            : image.platform === "facebook"
                              ? "Facebook"
                              : "TikTok"}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-600">
            Tag us{" "}
            <span className="font-semibold text-[var(--coffee-brown)]">
              @wildbeancoffeellc
            </span>{" "}
            for a chance to be featured!
          </p>
        </motion.div>
      </div>
    </section>
  );
}
