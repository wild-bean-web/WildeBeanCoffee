"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useMenu } from "@/hooks/useMenu";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorDisplay from "@/components/ErrorDisplay";

export default function MenuPage() {
  const [selectedSection, setSelectedSection] = useState("");
  const [cart, setCart] = useState([]);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch menu items using custom hook
  const { menuItems, loading, error } = useMenu();

  // Define the desired order for filter buttons
  const sectionOrder = [
    "Coffee & Espresso",
    "Smoothies (Organic & Fresh)",
    "Oatmeals",
    "Bakery & Pastries",
    "Tea",
  ];

  // Map section names to display names for filter buttons
  const sectionDisplayNames = {
    "Smoothies (Organic & Fresh)": "Smoothies",
  };

  // Get unique sections and order them according to sectionOrder
  const sections = useMemo(() => {
    const uniqueSections = [...new Set(menuItems.map((item) => item.section))].filter(Boolean);
    
    // Sort sections: first by sectionOrder, then any remaining sections alphabetically
    const ordered = sectionOrder.filter((section) => uniqueSections.includes(section));
    const remaining = uniqueSections
      .filter((section) => !sectionOrder.includes(section))
      .sort();
    
    return [...ordered, ...remaining];
  }, [menuItems]);

  // Helper function to get display name for a section
  const getSectionDisplayName = (section) => {
    return sectionDisplayNames[section] || section;
  };

  // Filter menu items by section
  const filteredItems = useMemo(
    () =>
      selectedSection
        ? menuItems.filter((item) => item.section === selectedSection)
        : menuItems,
    [menuItems, selectedSection]
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

  useEffect(() => {
    // Load cart from localStorage
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  const addToCart = (menuItem) => {
    const existingItem = cart.find((item) => item._id === menuItem._id);
    let updatedCart;
    if (existingItem) {
      updatedCart = cart.map((item) =>
        item._id === menuItem._id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      updatedCart = [...cart, { ...menuItem, quantity: 1, itemType: "menu" }];
    }
    setCart(updatedCart);
    localStorage.setItem("cart", JSON.stringify(updatedCart));
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
          </div>
          
          {/* Section Filter */}
          {sections.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setSelectedSection("")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
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
                  onClick={() => setSelectedSection(section)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
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

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">

        {/* Menu Items by Section */}
        <div className="space-y-12">
          {Object.entries(groupedItems).map(([section, items]) => (
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
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <motion.div
                    key={item._id}
                    whileHover={{ y: -4 }}
                    className="group cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-white transition-all hover:border-[var(--lime-green)] hover:shadow-lg"
                    onClick={() => openMenuItemModal(item)}
                  >
                    {/* Image Section */}
                    {item.image && (
                      <div className="relative h-48 w-full overflow-hidden bg-gray-100">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-110"
                          unoptimized
                        />
                      </div>
                    )}
                    
                    {/* Content Section */}
                    <div className="p-4">
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
                        ) : (
                          <div className="border-t border-gray-100 pt-2">
                            {/* Empty space to maintain consistent height */}
                          </div>
                        )}
                      </div>
                      
                      {item.available ? (
                        getCartQuantity(item._id) > 0 ? (
                          <div className="mt-3 flex items-center justify-between rounded-full border-2 border-[var(--coffee-brown-medium-light)] bg-[var(--coffee-brown-medium-light)]">
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
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(item);
                            }}
                            className="mt-3 w-full rounded-full bg-[var(--lime-green)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--lime-green-dark)]"
                          >
                            Add to Cart
                          </button>
                        )
                      ) : (
                        <p className="mt-2 text-xs text-red-600">
                          Currently Unavailable
                        </p>
                      )}
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
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white shadow-lg">
            <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--coffee-brown)]">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)} item(s)
                    in cart
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatPrice(
                      cart.reduce(
                        (sum, item) => sum + item.price * item.quantity,
                        0
                      )
                    )}
                  </p>
                </div>
                <Link
                  href="/order"
                  className="rounded-full bg-[var(--lime-green)] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--lime-green-dark)]"
                >
                  Checkout
                </Link>
              </div>
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
                {selectedMenuItem.image && (
                  <div className="relative h-64 w-full bg-gray-200 sm:h-80">
                    <Image
                      src={selectedMenuItem.image}
                      alt={selectedMenuItem.name}
                      fill
                      className="object-cover"
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

                  {/* Availability and Add to Cart */}
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div>
                      {selectedMenuItem.available ? (
                        <p className="text-sm text-[var(--lime-green)]">
                          ✓ Available
                        </p>
                      ) : (
                        <p className="text-sm text-red-600">
                          Currently Unavailable
                        </p>
                      )}
                    </div>
                    {selectedMenuItem.available && (
                      getCartQuantity(selectedMenuItem._id) > 0 ? (
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
                      ) : (
                        <button
                          onClick={() => addToCart(selectedMenuItem)}
                          className="rounded-full bg-[var(--lime-green)] px-8 py-3 text-lg font-semibold text-white transition-colors hover:bg-[var(--lime-green-dark)]"
                        >
                          Add to Cart
                        </button>
                      )
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
