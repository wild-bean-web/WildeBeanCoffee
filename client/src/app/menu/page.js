"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMenu } from "@/hooks/useMenu";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorDisplay from "@/components/ErrorDisplay";
import CustomizationModal from "@/components/CustomizationModal";
import BeanStampsPromo from "@/components/BeanStampsPromo";
import { GRAND_OPENING_DATE, PASTRIES_ORDERING_ENABLED, PASTRIES_SECTION_NAME } from "@/lib/constants";

function MenuPageContent() {
  const searchParams = useSearchParams();
  const [selectedSection, setSelectedSection] = useState("");
  const [cart, setCart] = useState([]);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomizationModalOpen, setIsCustomizationModalOpen] = useState(false);
  const [itemToCustomize, setItemToCustomize] = useState(null);
  const [now, setNow] = useState(() => (typeof window !== "undefined" ? Date.now() : 0));

  // Fetch menu items using custom hook
  const { menuItems, loading, error } = useMenu();

  const isOrderingOpenToAll = now >= GRAND_OPENING_DATE.getTime();
  const hidePastries = isOrderingOpenToAll && !PASTRIES_ORDERING_ENABLED;
  const visibleMenuItems = useMemo(
    () =>
      hidePastries
        ? menuItems.filter((item) => item.section !== PASTRIES_SECTION_NAME)
        : menuItems,
    [menuItems, hidePastries]
  );

  // Define the desired order for filter buttons
  const sectionOrder = [
    "Coffee & Espresso",
    "Tea",
    "Smoothies (Organic & Fresh)",
    "Wild Bowl",
    "Bakery & Pastries",
  ];

  // Map section names to display names for filter buttons
  const sectionDisplayNames = {
    "Smoothies (Organic & Fresh)": "Smoothies",
    "Tea": "Tea & Milk",
  };

  // Get unique sections and order them according to sectionOrder (from visible items only)
  const sections = useMemo(() => {
    const uniqueSections = [...new Set(visibleMenuItems.map((item) => item.section))].filter(Boolean);
    
    // Sort sections: first by sectionOrder, then any remaining sections alphabetically
    const ordered = sectionOrder.filter((section) => uniqueSections.includes(section));
    const remaining = uniqueSections
      .filter((section) => !sectionOrder.includes(section))
      .sort();
    
    return [...ordered, ...remaining];
  }, [visibleMenuItems]);

  // Helper function to get display name for a section
  const getSectionDisplayName = (section) => {
    return sectionDisplayNames[section] || section;
  };

  // Filter menu items by section
  const filteredItems = useMemo(
    () =>
      selectedSection
        ? visibleMenuItems.filter((item) => item.section === selectedSection)
        : visibleMenuItems,
    [visibleMenuItems, selectedSection]
  );

  // Group items by section
  const groupedItems = useMemo(
    () =>
      filteredItems.reduce((acc, item) => {
        const section = item.section || "Other";
        if (!acc[section]) {
          acc[section] = [];
        }
        acc[section].push(item);
        return acc;
      }, {}),
    [filteredItems]
  );

  // Define section display order for "All Items" view
  const sectionDisplayOrder = [
    "Coffee & Espresso",
    "Tea",
    "Smoothies (Organic & Fresh)",
    "Wild Bowl",
    "Bakery & Pastries",
  ];

  // Sort grouped items by section order
  const sortedGroupedItems = useMemo(() => {
    const entries = Object.entries(groupedItems);
    
    // Sort entries based on sectionDisplayOrder
    entries.sort((a, b) => {
      const aIndex = sectionDisplayOrder.indexOf(a[0]);
      const bIndex = sectionDisplayOrder.indexOf(b[0]);
      
      // If both sections are in the order list, sort by their position
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      // If only one is in the list, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      // If neither is in the list, sort alphabetically
      return a[0].localeCompare(b[0]);
    });
    
    return Object.fromEntries(entries);
  }, [groupedItems]);

  // Update "now" every second so pastries section hides automatically when opening time passes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // When pastries are hidden, clear Bakery & Pastries from selected section so user doesn't see empty view
  useEffect(() => {
    if (hidePastries && selectedSection === PASTRIES_SECTION_NAME) {
      setSelectedSection("");
    }
  }, [hidePastries, selectedSection]);

  useEffect(() => {
    // Load cart from localStorage
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }

    // Restore selected section from URL query param
    const sectionFromUrl = searchParams.get("section");
    if (sectionFromUrl) {
      setSelectedSection(sectionFromUrl);
      // Also save to sessionStorage for consistency
      sessionStorage.setItem("menuSelectedSection", sectionFromUrl);
    } else {
      // Try to restore from sessionStorage if no URL param
      const savedSection = sessionStorage.getItem("menuSelectedSection");
      if (savedSection) {
        setSelectedSection(savedSection);
      }
    }
  }, [searchParams]);

  // Save selected section to sessionStorage when it changes (but don't update URL to avoid loops)
  useEffect(() => {
    if (selectedSection) {
      sessionStorage.setItem("menuSelectedSection", selectedSection);
    } else {
      sessionStorage.removeItem("menuSelectedSection");
    }
  }, [selectedSection]);

  const addToCart = (menuItem, modifiers = null, modifierTotal = 0) => {
    // If item has modifiers, use the cartKey to identify unique combinations
    const cartKey = modifiers
      ? `${menuItem._id}_${JSON.stringify(modifiers)}`
      : `${menuItem._id}_default`;

    const existingItem = cart.find(
      (item) => item.cartKey === cartKey || (!item.cartKey && item._id === menuItem._id && !item.modifiers)
    );

    let updatedCart;
    if (existingItem) {
      updatedCart = cart.map((item) =>
        item.cartKey === cartKey || (item._id === menuItem._id && !item.modifiers && !modifiers)
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      const cartItem = {
        ...menuItem,
        quantity: 1,
        itemType: "menu",
        cartKey,
      };
      
      if (modifiers) {
        cartItem.modifiers = modifiers;
        cartItem.modifierTotal = modifierTotal;
      }
      
      updatedCart = [...cart, cartItem];
    }
    setCart(updatedCart);
    localStorage.setItem("cart", JSON.stringify(updatedCart));
  };

  const handleAddToCartClick = (menuItem) => {
    if (menuItem.onlineOrderable === false) return;
    // Check if item has modifier groups
    const hasModifiers = menuItem.modifierGroups && menuItem.modifierGroups.length > 0;
    
    if (hasModifiers) {
      // Open customization modal
      setItemToCustomize(menuItem);
      setIsCustomizationModalOpen(true);
      // Close the detail modal
      setIsModalOpen(false);
    } else {
      // Add directly to cart (no modifiers)
      addToCart(menuItem);
    }
  };

  const handleCustomizationAddToCart = (cartItem) => {
    addToCart(
      cartItem,
      cartItem.modifiers,
      cartItem.modifierTotal
    );
    setIsCustomizationModalOpen(false);
    setItemToCustomize(null);
  };

  const updateCartQuantity = (menuItem, change) => {
    const existingItem = cart.find((item) => item._id === menuItem._id);
    if (!existingItem) return;

    let updatedCart;
    if (existingItem.quantity + change <= 0) {
      // Remove item if quantity would be 0 or less
      updatedCart = cart.filter((item) => item._id !== menuItem._id);
    } else {
      updatedCart = cart.map((item) =>
        item._id === menuItem._id
          ? { ...item, quantity: item.quantity + change }
          : item
      );
    }
    setCart(updatedCart);
    localStorage.setItem("cart", JSON.stringify(updatedCart));
  };

  const getCartQuantity = (itemId) => {
    const cartItem = cart.find((item) => item._id === itemId);
    return cartItem ? cartItem.quantity : 0;
  };

  const openMenuItemModal = (item) => {
    setSelectedMenuItem(item);
    setIsModalOpen(true);
  };

  const closeMenuItemModal = () => {
    setIsModalOpen(false);
    setSelectedMenuItem(null);
  };

  const formatPrice = (price, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(price);
  };

  if (loading) {
    return <LoadingSpinner message="Loading menu..." className="min-h-screen" />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <ErrorDisplay message={`Error: ${error}`} />
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-[var(--lime-green)] px-6 py-2 text-white hover:bg-[var(--lime-green-dark)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Full Width */}
      <div className="bg-[var(--coffee-brown-very-light)] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="mb-4 text-4xl font-bold text-[var(--coffee-brown)] sm:text-5xl">
              Menu
            </h1>
            <p className="mb-6 text-lg text-gray-600">
              Explore our selection of beverages, pastries, and smoothies
            </p>
            <div className="mx-auto max-w-3xl text-left">
              <BeanStampsPromo variant="menu" />
            </div>
          </div>

          {/* Section Filter */}
          {sections.length > 0 && (
            <div className="mx-auto mt-6 flex max-w-4xl flex-wrap justify-center gap-x-2.5 gap-y-3 px-1 sm:mt-7 sm:gap-x-3 sm:gap-y-3 sm:px-0">
              <button
                onClick={() => setSelectedSection("")}
                type="button"
                className={`min-h-[2.75rem] rounded-full px-4 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:px-5 sm:py-2.5 ${
                  selectedSection === ""
                    ? "bg-[var(--lime-green)] text-white"
                    : "bg-white text-[var(--coffee-brown)] hover:bg-gray-100"
                }`}
              >
                All Items
              </button>
              {sections.map((section) => (
                <button
                  key={section}
                  type="button"
                  onClick={() => setSelectedSection(section)}
                  className={`min-h-[2.75rem] rounded-full px-4 py-2 text-sm font-medium transition-colors sm:min-h-0 sm:px-5 sm:py-2.5 ${
                    selectedSection === section
                      ? "bg-[var(--lime-green)] text-white"
                      : "bg-white text-[var(--coffee-brown)] hover:bg-gray-100"
                  }`}
                >
                  {getSectionDisplayName(section)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cafe highlights: coffee, bowls, gelato */}
      <div className="border-y border-[var(--lime-green)]/30 bg-gradient-to-r from-[var(--coffee-brown)]/10 to-[var(--lime-green)]/10 py-3 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl text-center space-y-1.5 sm:space-y-0 sm:space-x-2">
          <p className="text-sm font-medium text-[var(--coffee-brown)] sm:text-base sm:inline">
            <span className="font-semibold text-[var(--lime-green)]">Our coffee:</span> Yirgacheffe — specialty Ethiopian Arabica from high-altitude farms; bright, light-bodied, with floral jasmine, citrus &amp; bergamot, and fruit notes. Our house bean for drinks at the cafe.
          </p>
          <p className="text-sm font-medium text-[var(--coffee-brown)] sm:text-base sm:inline sm:before:content-['\00a0•\00a0']">
            <span className="font-semibold text-[var(--lime-green)]">In store:</span> Vegan Bowl &amp; Signature Bowl built with wholesome ingredients, plus Villa Dolce gelato favorites including Tiramisu, Madagascar Vanilla Bean, and Dark Chocolate. Our Tiramisu Affogato is served with a double shot of espresso.
          </p>
        </div>
      </div>

      <div className={`py-8 px-4 sm:px-6 lg:px-8 ${cart.length > 0 ? 'pb-24' : ''}`}>
        <div className="mx-auto max-w-7xl">

        {/* Menu Items by Section */}
        <div className="space-y-12">
          {Object.entries(sortedGroupedItems).map(([section, items]) => (
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="rounded-lg bg-white p-6 shadow-md"
            >
              <h2 className="mb-6 border-b-2 border-[var(--lime-green)] pb-2 text-2xl font-bold text-[var(--coffee-brown)]">
                {section}
              </h2>
              {section === PASTRIES_SECTION_NAME && (
                <div
                  id="bakery-in-store-notice"
                  className="mb-6 flex gap-3 rounded-xl border-2 border-[var(--lime-green)]/50 bg-gradient-to-r from-[var(--lime-green)]/15 to-amber-50/80 px-4 py-3 shadow-sm sm:items-center sm:gap-4 sm:px-5 sm:py-4"
                  role="region"
                  aria-label="Bakery and pastries ordering policy"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--coffee-brown)] text-white sm:h-12 sm:w-12"
                    aria-hidden="true"
                  >
                    <svg
                      className="h-5 w-5 sm:h-6 sm:w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-[var(--coffee-brown)] sm:text-lg">
                      In-store only — not available for online order
                    </p>
                    <p className="mt-1 text-sm leading-snug text-gray-700">
                      Browse our pastries below, then visit the cafe to buy. Selection and availability change daily.
                    </p>
                  </div>
                </div>
              )}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <motion.div
                    key={item._id}
                    whileHover={{ y: -4 }}
                    className="group cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white transition-all hover:border-[var(--lime-green)] hover:shadow-lg flex flex-col h-full"
                    onClick={() => openMenuItemModal(item)}
                  >
                    {/* Image Section */}
                    {item.image ? (
                      <div className="relative h-48 w-full overflow-hidden bg-gray-100">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-110"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="flex h-48 w-full items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 border-b border-gray-100">
                        <div className="text-center px-4">
                          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="mt-2 text-xs font-medium text-gray-400">Photo coming soon</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Content Section */}
                    <div className="p-4 flex flex-col flex-1">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="mb-1 text-lg font-semibold text-[var(--lime-green)]">
                            {item.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {item.description}
                          </p>
                        </div>
                        <div className="ml-4 text-right">
                          <p className="text-xl font-bold text-[var(--coffee-brown)]">
                            {formatPrice(item.price, item.currency)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="mb-2 min-h-[60px]">
                        {item.allergens && item.allergens.length > 0 ? (
                          <div className="border-t border-gray-100 pt-2">
                            <p className="mb-1 text-xs font-semibold text-amber-700">
                              Contains:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {item.allergens.map((allergen, idx) => (
                                <span
                                  key={idx}
                                  className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200"
                                >
                                  {allergen}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : item.name === "Build Your Own Bowl" ? (
                          <div className="border-t border-gray-100 pt-2">
                            <p className="text-xs text-gray-500">
                              Allergen info for add-ons varies. Cross-contamination may occur.
                            </p>
                          </div>
                        ) : (
                          <div className="border-t border-gray-100 pt-2">
                            {/* Empty space to maintain consistent height */}
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-auto">
                        {item.available ? (
                          item.onlineOrderable === false ? (
                            <div className="min-h-[42px]" aria-hidden="true" />
                          ) : // For items with modifiers, always show "Add to Cart" to allow different customizations
                          // For items without modifiers, show quantity controls if already in cart
                          (item.modifierGroups && item.modifierGroups.length > 0) || getCartQuantity(item._id) === 0 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCartClick(item);
                              }}
                              className="w-full rounded-full bg-[var(--lime-green)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--lime-green-dark)]"
                            >
                              {item.name === "Build Your Own Bowl" && item.modifierGroups?.length > 0 ? "Customize" : "Add to Cart"}
                            </button>
                          ) : (
                            <div className="flex items-center justify-between rounded-full border-2 border-[var(--coffee-brown-medium-light)] bg-[var(--coffee-brown-medium-light)]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateCartQuantity(item, -1);
                                }}
                                className="flex h-10 w-10 items-center justify-center rounded-l-full text-[var(--coffee-brown)] transition-colors hover:bg-[var(--coffee-brown-light)] hover:text-white"
                                aria-label="Decrease quantity"
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
                                    d="M20 12H4"
                                  />
                                </svg>
                              </button>
                              <span className="flex flex-1 items-center justify-center gap-1.5 text-sm font-semibold text-[var(--coffee-brown)]">
                                <span>{getCartQuantity(item._id)}</span>
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                                  />
                                </svg>
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateCartQuantity(item, 1);
                                }}
                                className="flex h-10 w-10 items-center justify-center rounded-r-full text-[var(--coffee-brown)] transition-colors hover:bg-[var(--coffee-brown-light)] hover:text-white"
                                aria-label="Increase quantity"
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
                                    d="M12 4v16m8-8H4"
                                  />
                                </svg>
                              </button>
                            </div>
                          )
                        ) : (
                          <p className="text-xs text-red-600">
                            Currently Unavailable
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="rounded-lg bg-white p-12 text-center shadow-md">
            <p className="text-lg text-gray-600">No menu items found.</p>
            <p className="mt-2 text-sm text-gray-500">
              Try selecting a different section.
            </p>
          </div>
        )}

        {/* Cart Summary (sticky at bottom) */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-6 sm:px-6">
            <div className="mx-auto w-full max-w-7xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-full bg-gradient-to-r from-gray-100 to-gray-50 backdrop-blur-md shadow-2xl border border-gray-300/70 px-5 py-3.5 sm:px-6"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-[var(--coffee-brown)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-[var(--coffee-brown)]">
                        {cart.reduce((sum, item) => sum + item.quantity, 0)} item{cart.reduce((sum, item) => sum + item.quantity, 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="h-6 w-px bg-gray-300"></div>
                    <p className="text-base font-bold text-[var(--coffee-brown)]">
                      {formatPrice(
                        cart.reduce(
                          (sum, item) => sum + item.price * item.quantity,
                          0
                        )
                      )}
                    </p>
                  </div>
                  <Link
                    href={selectedSection ? `/order?fromSection=${encodeURIComponent(selectedSection)}` : "/order"}
                    className="rounded-full bg-[var(--lime-green)] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--lime-green-dark)] hover:shadow-md active:scale-95"
                  >
                    Checkout
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* Menu Item Detail Modal */}
        <AnimatePresence>
          {isModalOpen && selectedMenuItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={closeMenuItemModal}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl"
              >
                {/* Image Section */}
                {selectedMenuItem.image ? (
                  <div className="relative h-80 w-full bg-gray-200 sm:h-96">
                    <Image
                      src={selectedMenuItem.image}
                      alt={selectedMenuItem.name}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                    <button
                      onClick={closeMenuItemModal}
                      className="absolute right-4 top-4 rounded-full bg-white/90 p-2 shadow-md transition-colors hover:bg-white"
                    >
                      <svg
                        className="h-6 w-6 text-[var(--coffee-brown)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex h-80 w-full items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 sm:h-96">
                    <div className="text-center px-6">
                      <svg className="mx-auto h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="mt-3 text-sm font-medium text-gray-400">Photo coming soon</p>
                    </div>
                    <button
                      onClick={closeMenuItemModal}
                      className="absolute right-4 top-4 rounded-full bg-white/90 p-2 shadow-md transition-colors hover:bg-white"
                    >
                      <svg
                        className="h-6 w-6 text-[var(--coffee-brown)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Content Section */}
                <div className="p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <h2 className="mb-2 text-3xl font-bold text-[var(--coffee-brown)]">
                        {selectedMenuItem.name}
                      </h2>
                      {selectedMenuItem.section && (
                        <span className="inline-block rounded-full bg-[var(--lime-green-light)] px-3 py-1 text-sm text-[var(--coffee-brown)]">
                          {selectedMenuItem.section}
                        </span>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-3xl font-bold text-[var(--coffee-brown)]">
                        {formatPrice(
                          selectedMenuItem.price,
                          selectedMenuItem.currency
                        )}
                      </p>
                    </div>
                  </div>

                  {selectedMenuItem.description && (
                    <p className="mb-4 text-gray-700">
                      {selectedMenuItem.description}
                    </p>
                  )}

                  {/* Allergens */}
                  {selectedMenuItem.allergens &&
                    selectedMenuItem.allergens.length > 0 && (
                      <div className="mb-4">
                        <h3 className="mb-2 font-semibold text-[var(--coffee-brown)]">
                          Contains:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedMenuItem.allergens.map((allergen, idx) => (
                            <span
                              key={idx}
                              className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 border border-amber-200"
                            >
                              {allergen}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {selectedMenuItem.name === "Build Your Own Bowl" && (
                    <p className="mb-4 text-xs text-gray-500">
                      Allergen info for add-ons varies. Cross-contamination may occur. See{" "}
                      <Link href="/terms" className="underline hover:text-gray-700">Terms of Use</Link>.
                    </p>
                  )}

                  {/* Availability and Add to Cart */}
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div>
                      {selectedMenuItem.available ? (
                        selectedMenuItem.onlineOrderable === false ? (
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold text-[var(--coffee-brown)]">In-store purchase only.</span>{" "}
                            Not available for online order — selection varies daily.
                          </p>
                        ) : (
                        <p className="text-sm text-[var(--lime-green)]">
                          ✓ Available
                        </p>
                        )
                      ) : (
                        <p className="text-sm text-red-600">
                          Currently Unavailable
                        </p>
                      )}
                    </div>
                    {selectedMenuItem.available && selectedMenuItem.onlineOrderable !== false && (
                      // For items with modifiers, always show "Add to Cart" to allow different customizations
                      // For items without modifiers, show quantity controls if already in cart
                      (selectedMenuItem.modifierGroups && selectedMenuItem.modifierGroups.length > 0) || getCartQuantity(selectedMenuItem._id) === 0 ? (
                        <button
                          onClick={() => handleAddToCartClick(selectedMenuItem)}
                          className="rounded-full bg-[var(--lime-green)] px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-[var(--lime-green-dark)]"
                        >
                          {selectedMenuItem.name === "Build Your Own Bowl" && selectedMenuItem.modifierGroups?.length > 0 ? "Customize" : "Add to Cart"}
                        </button>
                      ) : (
                        <div className="flex items-center justify-between rounded-full border-2 border-[var(--coffee-brown-medium-light)] bg-[var(--coffee-brown-medium-light)]">
                          <button
                            onClick={() =>
                              updateCartQuantity(selectedMenuItem, -1)
                            }
                            className="flex h-12 w-12 items-center justify-center rounded-l-full text-[var(--coffee-brown)] transition-colors hover:bg-[var(--coffee-brown-light)] hover:text-white"
                            aria-label="Decrease quantity"
                          >
                            <svg
                              className="h-6 w-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 12H4"
                              />
                            </svg>
                          </button>
                          <span className="flex flex-1 items-center justify-center gap-2 px-4 text-base font-semibold text-[var(--coffee-brown)]">
                            <span>{getCartQuantity(selectedMenuItem._id)}</span>
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
                                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                              />
                            </svg>
                          </span>
                          <button
                            onClick={() =>
                              updateCartQuantity(selectedMenuItem, 1)
                            }
                            className="flex h-12 w-12 items-center justify-center rounded-r-full text-[var(--coffee-brown)] transition-colors hover:bg-[var(--coffee-brown-light)] hover:text-white"
                            aria-label="Increase quantity"
                          >
                            <svg
                              className="h-6 w-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Customization Modal */}
        <CustomizationModal
          isOpen={isCustomizationModalOpen}
          onClose={() => {
            setIsCustomizationModalOpen(false);
            setItemToCustomize(null);
          }}
          menuItem={itemToCustomize}
          onAddToCart={handleCustomizationAddToCart}
        />

        <p className="mt-8 text-center text-xs text-gray-500">
          Allergen information is for awareness only. Cross-contamination may occur.{" "}
          <Link href="/terms" className="underline hover:text-gray-700">
            Terms of Use
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingSpinner message="Loading menu..." />
        </div>
      }
    >
      <MenuPageContent />
    </Suspense>
  );
}
