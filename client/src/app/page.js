"use client";

import Link from "next/link";
import Image from "next/image";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Lottie from "lottie-react";
import SocialMediaGallery from "@/components/SocialMediaGallery";
import { GRAND_OPENING_DATE, getGrandOpeningLabel } from "@/lib/constants";

function getTimeLeft(now) {
  const diff = Math.max(0, GRAND_OPENING_DATE.getTime() - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds };
}

export default function Home() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [prevSlide, setPrevSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const heroRef = useRef(null);
  const [freshRoastedAnimation, setFreshRoastedAnimation] = useState(null);
  const [artOfBrewingAnimation, setArtOfBrewingAnimation] = useState(null);
  const [googleReviewAnimation, setGoogleReviewAnimation] = useState(null);

  // Time-based state: only set after mount to avoid server/client hydration mismatch
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);
  const isOpen = mounted && now >= GRAND_OPENING_DATE.getTime();
  const timeLeft = getTimeLeft(now);

  // Load Lottie animation data
  useEffect(() => {
    // Load fresh-roasted animation
    fetch("/animations/fresh-roasted.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.text();
      })
      .then((text) => {
        try {
          const data = JSON.parse(text);
          setFreshRoastedAnimation(data);
        } catch (parseError) {
          console.error(
            "Failed to parse fresh-roasted Lottie JSON:",
            parseError,
          );
        }
      })
      .catch((err) =>
        console.error("Failed to load fresh-roasted Lottie animation:", err),
      );

    // Load artOfBrewing animation
    fetch("/animations/artOfBrewing.json")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.text();
      })
      .then((text) => {
        try {
          const data = JSON.parse(text);
          setArtOfBrewingAnimation(data);
        } catch (parseError) {
          console.error(
            "Failed to parse artOfBrewing Lottie JSON:",
            parseError,
          );
        }
      })
      .catch((err) =>
        console.error("Failed to load artOfBrewing Lottie animation:", err),
      );

    // Load Google Review Lottie
    fetch("/animations/googleReview.json")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load"))))
      .then((data) => setGoogleReviewAnimation(data))
      .catch((err) => console.error("Failed to load googleReview Lottie:", err));
  }, []);

  const slides = [
    {
      id: 1,
      title: "Wild Bean Coffee",
      titleSubtext: "Smoothie Cafe",
      subtitle: "Fresh Roasted Coffee & Handcrafted Beverages",
      description:
        "Experience the perfect blend of quality beans and artisanal craftsmanship.",
      cta: "View Menu",
      ctaLink: "/menu",
      cta2: "Order Online",
      cta2Link: "/order",
      bgImage: "/images/webDesignImages/HomePage/HomePage1.png",
    },
    {
      id: 2,
      title: "Premium Coffee Beans",
      subtitle: "Ethically Sourced & Freshly Roasted",
      description:
        "Discover our selection of single-origin and specialty coffee beans from around the world.",
      cta: "Browse Shop",
      ctaLink: "/shop",
      cta2: "View Menu",
      cta2Link: "/menu",
      bgImage: "/images/webDesignImages/HomePage/HomePage2.png",
    },
    {
      id: 3,
      title: "Handcrafted Beverages",
      subtitle: "Made with Care & Passion",
      description:
        "From classic espresso to refreshing smoothies, every drink is crafted to perfection.",
      cta: "View Menu",
      ctaLink: "/menu",
      cta2: "Order Now",
      cta2Link: "/order",
      bgImage: "/images/webDesignImages/HomePage/HomePage03.png",
    },
    {
      id: 4,
      title: "Visit Our Cafe",
      subtitle: "Experience the Atmosphere",
      description:
        "Come visit us at 1532 Rockville Pike for an unforgettable coffee experience.",
      cta: "Get Directions",
      ctaLink: "/location",
      cta2: "Order Online",
      cta2Link: "/order",
      bgImage: "/images/webDesignImages/HomePage/HomePage4.png",
    },
  ];

  // After mount: set time and tick every second (avoids hydration mismatch)
  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize visibility
  useEffect(() => {
    setIsVisible(true);
  }, []);

  const goToSlide = (index, slideDirection) => {
    setPrevSlide(currentSlide);
    setDirection(slideDirection); // 1 for right-to-left, -1 for left-to-right
    setCurrentSlide(index);
  };

  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? "100%" : "-100%", // Enter from right if direction > 0, from left if < 0
      opacity: 1,
    }),
    center: {
      x: "0%", // Center position
      opacity: 1,
    },
    exit: (direction) => ({
      x: direction > 0 ? "-100%" : "100%", // Exit to left if direction > 0, to right if < 0
      opacity: 1,
    }),
  };

  const slideTransition = {
    x: { type: "tween", duration: 0.8, ease: "easeInOut" },
    opacity: { duration: 0.8 },
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: "easeOut" },
  };

  const staggerChildren = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  return (
    <div className="min-h-screen min-w-0 max-w-full bg-white overflow-x-hidden">
      {/* Grand opening countdown — only after mount, hidden after Feb 16, 2026 6am */}
      <AnimatePresence>
        {mounted && !isOpen && (
          <motion.section
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={{ duration: 0.4 }}
            className="relative z-30 bg-[var(--coffee-brown)] text-white shadow-lg"
          >
            <div className="mx-auto max-w-5xl px-4 py-4 sm:py-5">
              <p className="text-center text-lg font-semibold sm:text-xl text-[var(--lime-green)] mb-2">
                We're opening soon!
              </p>
              <p className="text-center text-base sm:text-lg text-white/95 mb-4">
                Join us <span className="font-bold text-white">{getGrandOpeningLabel()}</span> — online ordering and in-store service will be live.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
                <div className="flex flex-col items-center rounded-lg bg-white/15 px-4 py-2 min-w-[4rem]">
                  <span className="text-2xl sm:text-3xl font-bold tabular-nums">{String(timeLeft.days).padStart(2, "0")}</span>
                  <span className="text-xs sm:text-sm uppercase tracking-wider">Days</span>
                </div>
                <div className="flex flex-col items-center rounded-lg bg-white/15 px-4 py-2 min-w-[4rem]">
                  <span className="text-2xl sm:text-3xl font-bold tabular-nums">{String(timeLeft.hours).padStart(2, "0")}</span>
                  <span className="text-xs sm:text-sm uppercase tracking-wider">Hours</span>
                </div>
                <div className="flex flex-col items-center rounded-lg bg-white/15 px-4 py-2 min-w-[4rem]">
                  <span className="text-2xl sm:text-3xl font-bold tabular-nums">{String(timeLeft.minutes).padStart(2, "0")}</span>
                  <span className="text-xs sm:text-sm uppercase tracking-wider">Min</span>
                </div>
                <div className="flex flex-col items-center rounded-lg bg-white/15 px-4 py-2 min-w-[4rem]">
                  <span className="text-2xl sm:text-3xl font-bold tabular-nums">{String(timeLeft.seconds).padStart(2, "0")}</span>
                  <span className="text-xs sm:text-sm uppercase tracking-wider">Sec</span>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Advanced Carousel Hero Section */}
      <section
        ref={heroRef}
        className="relative flex min-h-[90vh] w-full max-w-full items-center justify-center overflow-hidden px-4 py-20 sm:px-6 lg:px-8"
      >
        <AnimatePresence initial={false} custom={direction}>
          {slides.map((slide, index) => {
            const isActive = index === currentSlide;
            const isPrev = index === prevSlide && prevSlide !== currentSlide;

            // Only render current slide and previous slide during transition
            if (!isActive && !isPrev) return null;

            return (
              <motion.div
                key={slide.id}
                custom={direction}
                variants={slideVariants}
                initial={isActive ? "enter" : "center"}
                animate={isActive ? "center" : "exit"}
                exit="exit"
                transition={slideTransition}
                className="absolute inset-0 flex items-center justify-center"
                style={{ willChange: "transform" }}
              >
                {/* Background Image with Modern Styling */}
                <div className="absolute inset-0">
                  <Image
                    src={slide.bgImage}
                    alt={slide.title}
                    fill
                    className="object-cover transition-transform duration-700 ease-out"
                    unoptimized
                    priority={currentSlide === 0}
                  />
                  {/* Modern overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--coffee-brown-dark)]/85 via-[var(--coffee-brown)]/75 to-[var(--coffee-brown-light)]/85"></div>
                  {/* Subtle vignette effect */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)",
                    }}
                  ></div>
                </div>

                <div className="relative z-10 mx-auto max-w-4xl text-center">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                  >
                    <motion.h1
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3, duration: 0.6, type: "spring" }}
                      className="mb-6 text-5xl font-bold leading-tight text-white sm:text-6xl md:text-7xl lg:text-8xl"
                    >
                      {slide.title === "Wild Bean Coffee" ? (
                        <>Wild Bean Coffee</>
                      ) : (
                        slide.title
                      )}
                      {slide.titleSubtext && (
                        <>
                          <br />
                          <span className="block text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
                            <span className="inline-block pl-8 sm:pl-12 md:pl-16 lg:pl-20">
                              &
                            </span>
                            <br />
                            <span className="inline-block pl-4 sm:pl-6 md:pl-8 lg:pl-10">
                              <span className="text-[var(--lime-green)]">
                                Smoothie
                              </span>{" "}
                              Cafe
                            </span>
                          </span>
                        </>
                      )}
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.6 }}
                      className="mb-8 text-xl text-white/90 sm:text-2xl md:text-3xl"
                    >
                      {slide.subtitle}
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.6 }}
                      className="mx-auto mb-12 max-w-2xl text-lg text-white/80 sm:text-xl"
                    >
                      {slide.description}
                    </motion.p>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6, duration: 0.6 }}
                      className="flex flex-col items-center justify-center gap-4 sm:flex-row"
                    >
                      <Link
                        href={slide.ctaLink}
                        className="group relative overflow-hidden rounded-full bg-[var(--lime-green)] px-8 py-4 text-lg font-semibold text-white transition-all duration-300 hover:bg-[var(--lime-green-dark)] hover:scale-105 hover:shadow-lg"
                      >
                        <span className="relative z-10">{slide.cta}</span>
                        <div className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-300 group-hover:translate-x-0"></div>
                      </Link>
                      <Link
                        href={slide.cta2Link}
                        className="rounded-full border-2 border-white bg-transparent px-8 py-4 text-lg font-semibold text-white transition-all duration-300 hover:bg-white hover:text-[var(--coffee-brown)] hover:scale-105"
                      >
                        {slide.cta2}
                      </Link>
                    </motion.div>
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Carousel Navigation Dots */}
        <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => {
                // Determine direction based on whether clicking forward or backward
                const slideDirection = index > currentSlide ? 1 : -1;
                goToSlide(index, slideDirection);
              }}
              className={`h-3 w-3 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? "w-8 bg-white"
                  : "bg-white/50 hover:bg-white/75"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={() => {
            const prev = (currentSlide - 1 + slides.length) % slides.length;
            goToSlide(prev, -1); // Left arrow: slide left-to-right (direction -1)
          }}
          className="absolute left-4 bottom-24 z-20 md:top-1/2 md:-translate-y-1/2 md:bottom-auto rounded-full bg-white/20 p-3 backdrop-blur-sm transition-all hover:bg-white/30 hover:scale-110"
          aria-label="Previous slide"
        >
          <svg
            className="h-6 w-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <button
          onClick={() => {
            const next = (currentSlide + 1) % slides.length;
            goToSlide(next, 1); // Right arrow: slide right-to-left (direction 1)
          }}
          className="absolute right-4 bottom-24 z-20 md:top-1/2 md:-translate-y-1/2 md:bottom-auto rounded-full bg-white/20 p-3 backdrop-blur-sm transition-all hover:bg-white/30 hover:scale-110"
          aria-label="Next slide"
        >
          <svg
            className="h-6 w-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="absolute bottom-20 left-1/2 z-20 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="h-8 w-8"
          >
            <svg
              className="h-8 w-8 text-white/70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl w-full overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1],
              type: "spring",
              stiffness: 100,
            }}
            className="mb-16 text-center"
          >
            <motion.h2
              className="mb-4 text-4xl font-bold text-[var(--coffee-brown)] sm:text-5xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Why Choose Wild Bean Coffee?
            </motion.h2>
            <motion.p
              className="mx-auto max-w-2xl text-lg text-gray-600"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              We're passionate about bringing you the finest coffee experience
            </motion.p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: "/animations/fresh-roasted.json",
                title: "Fresh Roasted",
                description:
                  "Our beans are roasted in-house daily to ensure maximum flavor and freshness.",
                enterFrom: "left", // From left side of screen
              },
              {
                icon: "/animations/artOfBrewing.json",
                title: "The Art of Brewing",
                description:
                  "We believe in the art of brewing, offering an experience that warms the heart and energizes the soul",
                enterFrom: "bottom", // From bottom of screen
              },
              {
                icon: "/images/icons/handcrafted.png",
                title: "Handcrafted",
                description:
                  "Every beverage is carefully prepared by our skilled baristas.",
                enterFrom: "right", // From right side of screen
              },
            ].map((feature, index) => {
              // Set initial position based on direction - subtle animation that works on all screens
              const getInitialPosition = () => {
                switch (feature.enterFrom) {
                  case "left":
                    return { x: -30, y: 0, opacity: 0 };
                  case "right":
                    return { x: 30, y: 0, opacity: 0 };
                  case "bottom":
                    return { x: 0, y: 30, opacity: 0 };
                  default:
                    return { x: 0, y: 0, opacity: 0 };
                }
              };

              const initialPos = getInitialPosition();

              return (
                <motion.div
                  key={index}
                  initial={initialPos}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                    x: 0,
                  }}
                  viewport={{ once: true, margin: "0px" }}
                  transition={{
                    duration: 0.9,
                    delay: index * 0.15,
                    ease: "easeOut",
                  }}
                  className="group rounded-xl border-2 border-gray-200 bg-white p-6 text-center shadow-md transition-shadow hover:shadow-lg"
                >
                  {/* Icon */}
                  <div className="mb-4 flex h-20 items-center justify-center overflow-hidden">
                    {feature.icon === "/animations/fresh-roasted.json" ? (
                      freshRoastedAnimation ? (
                        <div className="h-20 w-20 flex-shrink-0 overflow-hidden transition-all duration-500 ease-out group-hover:scale-110 group-hover:drop-shadow-2xl">
                          <Lottie
                            animationData={freshRoastedAnimation}
                            loop={true}
                            autoplay={true}
                            className="h-full w-full"
                          />
                        </div>
                      ) : (
                        <div className="h-20 w-20 flex items-center justify-center">
                          <div className="text-5xl">☕</div>
                        </div>
                      )
                    ) : feature.icon === "/animations/artOfBrewing.json" ? (
                      artOfBrewingAnimation ? (
                        <div className="h-20 w-20 flex-shrink-0 overflow-hidden transition-all duration-500 ease-out group-hover:scale-110 group-hover:drop-shadow-2xl">
                          <Lottie
                            animationData={artOfBrewingAnimation}
                            loop={true}
                            autoplay={true}
                            className="h-full w-full"
                          />
                        </div>
                      ) : (
                        <div className="h-20 w-20 flex items-center justify-center">
                          <div className="text-5xl">❤️</div>
                        </div>
                      )
                    ) : feature.icon.startsWith("/") ? (
                      <Image
                        src={feature.icon}
                        alt={feature.title}
                        width={80}
                        height={80}
                        className="h-20 w-20 flex-shrink-0 object-contain overflow-hidden transition-all duration-500 ease-out group-hover:scale-110 group-hover:drop-shadow-2xl"
                        unoptimized
                      />
                    ) : (
                      <div className="text-5xl leading-none transition-all duration-500 ease-out group-hover:scale-110 group-hover:drop-shadow-2xl">
                        {feature.icon}
                      </div>
                    )}
                  </div>

                  <h3 className="mb-3 text-2xl font-bold text-[var(--coffee-brown)]">
                    {feature.title}
                  </h3>

                  <p className="text-gray-700">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Social Media Gallery Section */}
      <SocialMediaGallery />

      {/* Google Review — Help us grow */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="overflow-hidden rounded-2xl border-2 border-[var(--lime-green)]/20 bg-gradient-to-b from-[var(--lime-green)]/5 to-white p-6 sm:p-8 shadow-lg ring-1 ring-black/5"
          >
            <h2 className="mb-2 text-center text-2xl font-bold text-[var(--coffee-brown)] sm:text-3xl">
              Help us grow — leave a review
            </h2>
            <p className="mb-6 text-center text-gray-600">
              Loved your visit? Scan below to leave us a review on Google. It means a lot!
            </p>
            {googleReviewAnimation ? (
              <div className="mb-4 flex justify-center">
                <Lottie
                  animationData={googleReviewAnimation}
                  loop={true}
                  className="h-28 w-full max-w-xs"
                />
              </div>
            ) : (
              <p className="mb-4 text-center text-sm font-medium text-[var(--coffee-brown)]">
                Review us on Google
              </p>
            )}
            <p className="mb-4 text-center text-sm text-gray-600">
              Scan the QR code below to leave a review
            </p>
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute -inset-3 rounded-2xl bg-gradient-to-br from-[var(--lime-green)]/30 to-[var(--coffee-brown)]/10 blur-sm" aria-hidden />
                <div className="relative flex flex-col items-center rounded-2xl border-2 border-[var(--lime-green)]/40 bg-white p-4 shadow-inner">
                  <div className="absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-[var(--lime-green)]/60 rounded-tl" aria-hidden />
                  <div className="absolute right-2 top-2 h-4 w-4 border-r-2 border-t-2 border-[var(--lime-green)]/60 rounded-tr" aria-hidden />
                  <div className="absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-[var(--lime-green)]/60 rounded-bl" aria-hidden />
                  <div className="absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-[var(--lime-green)]/60 rounded-br" aria-hidden />
                  <div className="relative h-40 w-40 rounded-xl bg-white p-3">
                    <Image
                      src="/images/QrCodes/GoogleReviewQRCODE.png"
                      alt="QR code to leave a Google review for Wild Bean Coffee"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--coffee-brown)]">
                    <svg className="h-4 w-4 text-[var(--lime-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Scan with your phone
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-[var(--lime-green)] to-[var(--lime-green-light)] py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="mb-6 text-4xl font-bold text-white sm:text-5xl">
              Ready to Experience Great Coffee?
            </h2>
            <p className="mb-8 text-xl text-white/90">
              Browse our selection of premium beans or order your favorite
              beverage online.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/shop"
                className="rounded-full bg-white px-8 py-4 text-lg font-semibold text-[var(--coffee-brown)] transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                Shop Now
              </Link>
              <Link
                href="/menu"
                className="rounded-full border-2 border-white bg-transparent px-8 py-4 text-lg font-semibold text-white transition-all duration-300 hover:bg-white hover:text-[var(--lime-green)] hover:scale-105"
              >
                View Menu
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
