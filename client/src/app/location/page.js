"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Lottie from "lottie-react";
import { useLocation } from "@/hooks/useLocation";
import { locationApi } from "@/lib/api";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorDisplay from "@/components/ErrorDisplay";

const Map = dynamic(() => import("pigeon-maps").then((m) => m.Map), {
  ssr: false,
});
const Marker = dynamic(() => import("pigeon-maps").then((m) => m.Marker), {
  ssr: false,
});

// Convert 24-hour format (HH:mm) to 12-hour format (h:mm AM/PM)
const formatTime12Hour = (time24) => {
  if (!time24 || time24 === "--") return time24;

  const [hours, minutes] = time24.split(":").map(Number);
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours >= 12 ? "PM" : "AM";
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
};

export default function LocationPage() {
  const router = useRouter();
  const [userCoords, setUserCoords] = useState(null);
  const [distance, setDistance] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(14);
  const [googleReviewAnimation, setGoogleReviewAnimation] = useState(null);

  // Fetch location using custom hook
  const { location: store, loading, error } = useLocation();

  // Load Google Review Lottie animation
  useEffect(() => {
    fetch("/animations/googleReview.json")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to load animation"))))
      .then((data) => setGoogleReviewAnimation(data))
      .catch((err) => console.error("Failed to load googleReview Lottie:", err));
  }, []);

  // Calculate map bounds to fit both store and user location
  const calculateMapBounds = (storeCoords, userCoords) => {
    if (!storeCoords || !userCoords) return null;

    const storeLat = storeCoords.lat;
    const storeLng = storeCoords.lng;
    const userLat = userCoords.lat;
    const userLng = userCoords.lng;

    // Calculate center point between store and user
    const centerLat = (storeLat + userLat) / 2;
    const centerLng = (storeLng + userLng) / 2;

    // Calculate the distance between the two points (rough approximation)
    const latDiff = Math.abs(storeLat - userLat);
    const lngDiff = Math.abs(storeLng - userLng);
    const maxDiff = Math.max(latDiff, lngDiff);

    // Determine zoom level based on distance
    // These zoom levels are approximate and may need tuning
    let zoom = 14;
    if (maxDiff > 0.1)
      zoom = 10; // Very far (>10km)
    else if (maxDiff > 0.05)
      zoom = 11; // Far (5-10km)
    else if (maxDiff > 0.02)
      zoom = 12; // Medium (2-5km)
    else if (maxDiff > 0.01)
      zoom = 13; // Close (1-2km)
    else zoom = 14; // Very close (<1km)

    return {
      center: [centerLat, centerLng],
      zoom: zoom,
    };
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported by your browser.");
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserCoords(coords);

        // Update map center and zoom to show both locations
        if (store?.coordinates?.lat && store?.coordinates?.lng) {
          const bounds = calculateMapBounds(store.coordinates, coords);
          if (bounds) {
            setMapCenter(bounds.center);
            setMapZoom(bounds.zoom);
          }

          setDistanceLoading(true);
          locationApi
            .calculateDistance(coords)
            .then((distanceData) => setDistance(distanceData))
            .catch((err) => setGeoError(err.message))
            .finally(() => setDistanceLoading(false));
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError("Location permission denied.");
        } else {
          setGeoError("Unable to retrieve location.");
        }
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  // Initialize map center when store loads
  useEffect(() => {
    if (store?.coordinates && !mapCenter) {
      setMapCenter([store.coordinates.lat, store.coordinates.lng]);
    }
  }, [store, mapCenter]);

  // Detect if user is on mobile device
  const isMobile = () => {
    if (typeof window === "undefined") return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  };

  // Handle navigation button click
  const handleNavigate = () => {
    if (!store?.address1) return;

    // Use address string instead of coordinates for more reliable navigation
    const address = `${store.address1}, ${store.city}, ${store.state} ${store.postalCode}`;
    const encodedAddress = encodeURIComponent(address);

    if (isMobile()) {
      // For mobile devices, try to open native navigation apps
      const userAgent = navigator.userAgent.toLowerCase();

      if (/iphone|ipad|ipod/.test(userAgent)) {
        // iOS - try Apple Maps first (opens Maps app) using address
        const appleMapsUrl = `maps://maps.apple.com/?daddr=${encodedAddress}&dirflg=d`;
        window.location.href = appleMapsUrl;

        // Fallback to Google Maps if Apple Maps doesn't open
        setTimeout(() => {
          const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
          window.open(googleMapsUrl, "_blank");
        }, 500);
      } else if (/android/.test(userAgent)) {
        // Android - use Google Maps navigation intent with address
        // First try with address, fallback to coordinates if needed
        const intentUrl =
          store?.coordinates?.lat && store?.coordinates?.lng
            ? `google.navigation:q=${store.coordinates.lat},${store.coordinates.lng}`
            : `google.navigation:q=${encodedAddress}`;
        window.location.href = intentUrl;

        // Fallback to web if intent doesn't work
        setTimeout(() => {
          const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
          window.open(webUrl, "_blank");
        }, 500);
      } else {
        // Other mobile devices - use Google Maps web
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
        window.open(googleMapsUrl, "_blank");
      }
    } else {
      // For desktop, open Google Maps in new tab
      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
      window.open(googleMapsUrl, "_blank");
    }
  };

  const center = useMemo(() => {
    if (mapCenter) {
      return mapCenter;
    }
    if (store?.coordinates) {
      return [store.coordinates.lat, store.coordinates.lng];
    }
    return [0, 0];
  }, [store, mapCenter]);

  const userMarker = useMemo(() => {
    if (!userCoords) return null;
    return [userCoords.lat, userCoords.lng];
  }, [userCoords]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header - Full Width */}
      <div className="bg-[var(--coffee-brown-very-light)] py-8">
        <div className="mx-auto max-w-6xl px-6">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center gap-2 text-[var(--coffee-brown)] hover:text-[var(--coffee-brown-dark)] transition-colors"
            aria-label="Go back"
          >
            <svg
              className="h-5 w-5"
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
            <span className="text-sm font-medium">Back</span>
          </button>

          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="space-y-3 text-center"
          >
            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--lime-green)]">
              Visit Us
            </p>
            <h1 className="text-4xl font-bold text-[var(--coffee-brown)] sm:text-5xl">
              Wild Bean Coffee
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-gray-600">
              Find our shop, view hours, and see your distance if you share
              location.
            </p>
          </motion.header>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
        {loading && <LoadingSpinner message="Loading location..." />}
        {!loading && error && <ErrorDisplay message={error} />}
        {!loading && !error && !store && (
          <ErrorDisplay message="No location available." />
        )}

        {store && (
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-6">
              {/* Map Card */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
                className="overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-lg transition-shadow hover:shadow-xl"
              >
                <div className="relative h-[400px] w-full">
                  <Map
                    height={400}
                    center={center}
                    zoom={mapZoom}
                    onBoundsChanged={({ center, zoom }) => {
                      // Allow manual zoom/pan but don't override when user location is set
                      if (!userCoords) {
                        setMapCenter(center);
                        setMapZoom(zoom);
                      }
                    }}
                  >
                    <Marker
                      width={40}
                      anchor={[
                        store.coordinates?.lat || 0,
                        store.coordinates?.lng || 0,
                      ]}
                      color="#7cb342"
                    />
                    {userMarker && (
                      <Marker width={30} anchor={userMarker} color="#2563eb" />
                    )}
                  </Map>

                  {/* Navigation Button Overlay */}
                  <button
                    onClick={handleNavigate}
                    className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full bg-[var(--lime-green)] px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[var(--lime-green-dark)] hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)] focus:ring-offset-2"
                    aria-label="Navigate to store"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                    <span>Navigate</span>
                  </button>
                </div>
                <div className="flex flex-col gap-2 border-t border-gray-200 bg-gradient-to-r from-[var(--coffee-brown-very-light)] to-white px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-[var(--coffee-brown)]">
                    <svg
                      className="h-5 w-5 text-[var(--lime-green)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span className="font-medium">
                      {store.address1}, {store.city}, {store.state}{" "}
                      {store.postalCode}
                    </span>
                  </div>
                  {distance && (
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--lime-green)]">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                      <span>
                        You are ~{distance.miles.toFixed(1)} mi (
                        {distance.km.toFixed(1)} km) away
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Location exterior image */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.5, ease: "easeOut" }}
                className="relative overflow-hidden rounded-2xl border-2 border-gray-200 shadow-lg aspect-[4/3] w-full"
              >
                <Image
                  src="/images/CafeImages/ExteriorImage.jpeg"
                  alt="Wild Bean Coffee storefront with outdoor seating and patio"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
              className="space-y-6"
            >
              {/* Address & Contact Card */}
              <div className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md transition-shadow hover:shadow-lg">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-[var(--coffee-brown)]">
                  <svg
                    className="h-6 w-6 text-[var(--lime-green)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Address & Contact
                </h2>
                <div className="space-y-3 text-gray-700">
                  <p className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--lime-green)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span>
                      {store.address1}
                      {store.address2 ? `, ${store.address2}` : ""}
                      <br />
                      {store.city}, {store.state} {store.postalCode}
                    </span>
                  </p>
                  {store.phone && (
                    <p className="flex items-center gap-3">
                      <svg
                        className="h-5 w-5 flex-shrink-0 text-[var(--lime-green)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      <a
                        href={`tel:${store.phone}`}
                        className="hover:text-[var(--lime-green)] transition-colors"
                      >
                        {store.phone}
                      </a>
                    </p>
                  )}
                  {store.email && (
                    <p className="flex items-center gap-3">
                      <svg
                        className="h-5 w-5 flex-shrink-0 text-[var(--lime-green)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      <a
                        href={`mailto:${store.email}`}
                        className="hover:text-[var(--lime-green)] transition-colors"
                      >
                        {store.email}
                      </a>
                    </p>
                  )}
                </div>
              </div>

              {/* Hours Card */}
              <div className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md transition-shadow hover:shadow-lg">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-[var(--coffee-brown)]">
                  <svg
                    className="h-6 w-6 text-[var(--lime-green)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Hours of Operation
                </h2>
                <ul className="space-y-2">
                  {store.hours?.map((h) => (
                    <li
                      key={h.day}
                      className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0"
                    >
                      <span className="font-medium text-[var(--coffee-brown)]">
                        {h.day}
                      </span>
                      <span className="text-gray-700">
                        {h.closed ? (
                          <span className="text-red-600">Closed</span>
                        ) : (
                          <span className="font-semibold text-[var(--lime-green)]">
                            {formatTime12Hour(h.opens)} -{" "}
                            {formatTime12Hour(h.closes)}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Location Button Card */}
              <div className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-[var(--coffee-brown)]">
                  <svg
                    className="h-6 w-6 text-[var(--lime-green)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  Your Location
                </h2>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    className="w-full rounded-full bg-[var(--lime-green)] px-6 py-3 text-base font-semibold text-white shadow-lg transition-all hover:bg-[var(--lime-green-dark)] hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)] focus:ring-offset-2"
                  >
                    {distanceLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="h-5 w-5 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Calculating...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        Use my location
                      </span>
                    )}
                  </button>
                  {geoError && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                      <p className="text-sm text-red-600">{geoError}</p>
                    </div>
                  )}
                  {userCoords && !distanceLoading && !distance && (
                    <p className="text-sm text-gray-600 text-center">
                      Location captured. Distance calculation pending store
                      coords.
                    </p>
                  )}
                </div>
              </div>

              {/* Google Review QR Code + Lottie */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="overflow-hidden rounded-2xl border-2 border-[var(--lime-green)]/20 bg-gradient-to-b from-[var(--lime-green)]/5 to-white p-6 shadow-lg ring-1 ring-black/5"
              >
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
                {/* Styled QR code frame */}
                <div className="flex justify-center">
                  <div className="relative">
                    {/* Outer glow / frame */}
                    <div className="absolute -inset-3 rounded-2xl bg-gradient-to-br from-[var(--lime-green)]/30 to-[var(--coffee-brown)]/10 blur-sm" aria-hidden />
                    <div className="relative flex flex-col items-center rounded-2xl border-2 border-[var(--lime-green)]/40 bg-white p-4 shadow-inner">
                      {/* Corner accents */}
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

              {store.mapsUrl && (
                <a
                  href={store.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-[var(--lime-green)] bg-white px-6 py-3 text-center font-semibold text-[var(--lime-green)] transition-all hover:bg-[var(--lime-green)] hover:text-white hover:shadow-lg"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  Open in Maps
                </a>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
