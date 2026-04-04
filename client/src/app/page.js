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
import BeanStampsPromo from "@/components/BeanStampsPromo";
import { GRAND_OPENING_DATE, getGrandOpeningLabel, GOOGLE_REVIEW_URL } from "@/lib/constants";

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
      subtitle: "Premium Coffee & Handcrafted Beverages",
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
      subtitle: "Ethically Sourced & Locally Roasted",
      description:
        "Discover our Ethiopian single-origin coffee, locally roasted for maximum flavor and freshness.",
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
        "From classic espresso to refreshing smoothies, every drink is made with care.",
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

      <BeanStampsPromo variant="home" />

      {/* Now at the cafe — coffee, açaí bowls, ice cream */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[var(--coffee-brown)] via-[var(--coffee-brown)] to-[var(--coffee-brown-dark)] py-14 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cpath fill=\'%23ffffff\' fill-opacity=\'0.03\' d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/svg%3E')] opacity-90" aria-hidden />
        <div className="relative mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center"
          >
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-[var(--lime-green)]">
              Now at the cafe
            </p>
            <h2 className="mb-3 text-3xl font-bold text-white sm:text-4xl md:text-5xl">
              New favorites &amp; single-origin coffee
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-white/85 sm:text-xl">
              Stop in to try our latest — available in store.
            </p>
          </motion.div>
          <div className="grid gap-8 md:grid-cols-3 md:gap-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="rounded-2xl border border-white/15 bg-white/10 p-6 text-center backdrop-blur-sm"
            >
              <h3 className="text-xl font-bold text-[var(--lime-green)] sm:text-2xl">
                Yirgacheffe
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/90 sm:text-base">
                Specialty Arabica from high-altitude farms (1,700–2,200+ m) in southern Ethiopia — bright, fragrant, and light-bodied. Look for floral jasmine, citrus and bergamot acidity, and fruit notes like blueberry and peach. We use it as our house coffee for every drink at the cafe.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="rounded-2xl border border-white/15 bg-white/10 p-6 text-center backdrop-blur-sm"
            >
              <h3 className="text-xl font-bold text-[var(--lime-green)] sm:text-2xl">
                Açaí bowls
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/90 sm:text-base">
                Organic Brazilian açaí — tropical, berry-forward flavor with a rich, creamy sorbet texture. Naturally vegan, gluten-free &amp; dairy-free, loaded with antioxidants. We top it with fresh fruit, granola, and more—indulgent taste that still fits a health-conscious day.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="rounded-2xl border border-white/15 bg-white/10 p-6 text-center backdrop-blur-sm"
            >
              <h3 className="text-xl font-bold text-[var(--lime-green)] sm:text-2xl">
                Ice cream
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/90 sm:text-base">
                Premium scoop ice cream — rich chocolate and real vanilla bean (Madagascar vanilla), extra-creamy with no artificial flavors or colors. We also offer a vegan pistachio with real nut pieces—so everyone gets a dessert worth coming back for.
              </p>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link
              href="/menu"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--lime-green)] px-6 py-3 font-semibold text-[var(--coffee-brown)] transition-all hover:bg-[var(--lime-green-light)] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)] focus:ring-offset-2 focus:ring-offset-[var(--coffee-brown)]"
            >
              View menu
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              href="/location"
              className="inline-flex items-center gap-2 rounded-full border-2 border-white/40 px-6 py-3 font-semibold text-white transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              Visit us
            </Link>
          </motion.div>
        </div>
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
              We're passionate about bringing you a great coffee experience
            </motion.p>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: "/animations/fresh-roasted.json",
                title: "Locally Roasted",
                description:
                  "We partner with a local roaster for our Ethiopian single-origin coffee, so every cup is fresh and full of flavor.",
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
              Loved your visit? Tap the button below to leave us a review on Google. It means a lot!
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
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--lime-green)] px-6 py-4 text-center font-semibold text-white shadow-lg transition-all hover:bg-[var(--lime-green-dark)] hover:shadow-xl active:scale-[0.98]"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Leave a review on Google
            </a>
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
