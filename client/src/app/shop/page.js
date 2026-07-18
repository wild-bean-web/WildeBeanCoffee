"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AddToCartButton from "@/components/AddToCartButton";
import Modal from "@/components/Modal";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorDisplay from "@/components/ErrorDisplay";
import RetailBeansShowcase from "@/components/RetailBeansShowcase";
import ImageComingSoon from "@/components/ImageComingSoon";
import { useProducts } from "@/hooks/useProducts";
import { applyRetailBeanOverrides } from "@/lib/retailBeans";

export default function ShopPage() {
  const router = useRouter();
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState("name");

  // Fetch products using custom hook (fetch all, filter client-side for complex search)
  const { products: rawProducts, loading, error } = useProducts();
  const products = useMemo(
    () => applyRetailBeanOverrides(rawProducts),
    [rawProducts]
  );

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [imageErrors, setImageErrors] = useState(new Set());

  // Load cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem("cart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  // Get unique categories
  const categories = useMemo(
    () => [...new Set(products.flatMap((p) => p.categories || []))].sort(),
    [products]
  );

  // Apply filters and sorting (client-side for complex search)
  // Featured retail beans (e.g. Yirgacheffe) stay in the top showcase only.
  const filteredProducts = useMemo(() => {
    let filtered = products.filter((p) => p.comingSoon);

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.origin?.toLowerCase().includes(query) ||
          p.flavorNotes?.some((note) =>
            note.toLowerCase().includes(query)
          )
      );
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter((p) =>
        p.categories?.includes(selectedCategory)
      );
    }

    // In stock filter
    if (showInStockOnly) {
      filtered = filtered.filter((p) => p.inStock);
    }

    // Sorting (unknown-price items last on low-to-high, first on high-to-low)
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price-low": {
          const aP = a.priceUnknown ? Infinity : a.price;
          const bP = b.priceUnknown ? Infinity : b.price;
          return aP - bP;
        }
        case "price-high": {
          const aP = a.priceUnknown ? -Infinity : a.price;
          const bP = b.priceUnknown ? -Infinity : b.price;
          return bP - aP;
        }
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [products, searchQuery, selectedCategory, showInStockOnly, sortBy]);

  const openProductModal = (product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const closeProductModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const addToCart = (product) => {
    const existingItem = cart.find((item) => item._id === product._id);
    let updatedCart;
    if (existingItem) {
      updatedCart = cart.map((item) =>
        item._id === product._id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      updatedCart = [...cart, { ...product, quantity: 1, itemType: "product" }];
    }
    setCart(updatedCart);
    localStorage.setItem("cart", JSON.stringify(updatedCart));
    closeProductModal();
  };

  const updateCartQuantity = (product, change) => {
    const existingItem = cart.find((item) => item._id === product._id);
    if (!existingItem) return;

    let updatedCart;
    if (existingItem.quantity + change <= 0) {
      // Remove item if quantity would be 0 or less
      updatedCart = cart.filter((item) => item._id !== product._id);
    } else {
      updatedCart = cart.map((item) =>
        item._id === product._id
          ? { ...item, quantity: item.quantity + change }
          : item
      );
    }
    setCart(updatedCart);
    localStorage.setItem("cart", JSON.stringify(updatedCart));
  };

  const getCartQuantity = (productId) => {
    const cartItem = cart.find((item) => item._id === productId);
    return cartItem ? cartItem.quantity : 0;
  };

  const formatPrice = (price, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(price);
  };

  const formatProductPrice = (product) => {
    if (product.priceUnknown) return "$--.--";
    return formatPrice(product.price, product.currency);
  };

  if (loading) {
    return <LoadingSpinner message="Loading products..." className="min-h-screen" />;
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

          <div className="text-center">
            <h1 className="mb-4 text-4xl font-bold text-[var(--coffee-brown)] sm:text-5xl">
              Shop Coffee Beans
            </h1>
            <p className="text-lg text-gray-600">
              Fresh roasted whole beans — available now in store
            </p>
          </div>
        </div>
      </div>

      <RetailBeansShowcase variant="shop" />

      {/* In-store retail notice */}
      <div className="border-b border-[var(--lime-green)]/25 bg-[var(--lime-green)]/10 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-center text-sm font-medium text-[var(--coffee-brown)] sm:text-base">
            <span className="font-semibold">Whole-bean bags are sold in store only</span>
            {" "}— pick up Ethiopian Yirgacheffe (12 oz whole beans) at our Rockville cafe. Online bag ordering is not available.
          </p>
        </div>
      </div>

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">

        {/* Filters and Sort - Only show if there are more than 2 products */}
        {products.length > 2 && (
          <>
            <div className="mb-8 rounded-lg bg-white p-4 shadow-md">
              <div className="grid gap-4 md:grid-cols-4">
                {/* Search */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--coffee-brown)]">
                    Search
                  </label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search coffee beans..."
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-[var(--lime-green)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)]"
                  />
                </div>

                {/* Category Filter */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--coffee-brown)]">
                    Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-[var(--lime-green)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)]"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--coffee-brown)]">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-[var(--lime-green)] focus:outline-none focus:ring-2 focus:ring-[var(--lime-green)]"
                  >
                    <option value="name">Name (A-Z)</option>
                    <option value="price-low">Price (Low to High)</option>
                    <option value="price-high">Price (High to Low)</option>
                  </select>
                </div>

                {/* In Stock Toggle */}
                <div className="flex flex-col">
                  <label className="mb-2 block text-sm font-medium text-[var(--coffee-brown)]">
                    Filter
                  </label>
                  <div className="flex h-[42px] items-center">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showInStockOnly}
                        onChange={(e) => setShowInStockOnly(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-[var(--lime-green)] focus:ring-[var(--lime-green)]"
                      />
                      <span className="text-sm font-medium text-[var(--coffee-brown)]">
                        In Stock Only
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Count */}
            <p className="mb-6 text-sm text-gray-600">
              Showing {filteredProducts.length} of {products.length} products
            </p>
          </>
        )}

        {/* Unavailable / coming-soon beans only — featured retail is above */}
        {filteredProducts.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[var(--coffee-brown)] sm:text-2xl">
              More beans
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Additional single-origin options — not yet available for bag sale
            </p>
          </div>
        )}

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow-md">
            <p className="text-lg text-gray-600">No other beans to show right now.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence>
              {filteredProducts.map((product) => (
                <motion.div
                  key={product._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="group cursor-pointer overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 hover:shadow-xl"
                  onClick={() => openProductModal(product)}
                >
                  {/* Product Image */}
                  <div className="relative h-48 w-full bg-gray-200">
                    {product.imageComingSoon ||
                    !product.images?.length ||
                    imageErrors.has(product._id) ? (
                      <ImageComingSoon compact />
                    ) : (
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        className="object-contain bg-white p-2 transition-transform duration-300 group-hover:scale-105"
                        unoptimized
                        onError={() => setImageErrors(prev => new Set(prev).add(product._id))}
                      />
                    )}
                    {product.comingSoon && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-3">
                        <span className="text-center text-sm font-bold uppercase tracking-wide text-white">
                          Not yet for sale
                        </span>
                      </div>
                    )}
                    {!product.comingSoon && product.inStoreOnly && (
                      <div className="absolute left-3 top-3 rounded-full bg-[var(--coffee-brown)]/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                        In store only
                      </div>
                    )}
                    {!product.comingSoon && !product.inStock && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <span className="rounded bg-red-600 px-3 py-1 text-sm font-semibold text-white">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <h3 className="mb-1 text-lg font-semibold text-[var(--coffee-brown)]">
                      {product.name}
                    </h3>
                    {product.origin && (
                      <p className="mb-2 text-sm text-gray-600">
                        {product.origin}
                      </p>
                    )}
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {product.roastLevel && (
                        <span className="inline-block rounded-full bg-[var(--coffee-brown-light)] px-2 py-1 text-xs text-white">
                          {product.roastLevel}
                        </span>
                      )}
                      {product.bagSize && (
                        <span className="inline-block rounded-full bg-[var(--lime-green)]/15 px-2 py-1 text-xs font-medium text-[var(--lime-green-dark)]">
                          {product.bagSize}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xl font-bold text-[var(--coffee-brown)] tabular-nums">
                        {formatProductPrice(product)}
                      </span>
                      {product.comingSoon ? (
                        <span className="rounded-full bg-gray-300 px-4 py-2 text-sm font-semibold text-gray-600">
                          Coming Soon
                        </span>
                      ) : product.inStoreOnly ? (
                        <Link
                          href="/location"
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-full bg-[var(--lime-green)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--lime-green-dark)]"
                        >
                          Visit store
                        </Link>
                      ) : product.inStock ? (
                        <AddToCartButton
                          item={product}
                          quantity={getCartQuantity(product._id)}
                          onAdd={addToCart}
                          onIncrease={(item) => updateCartQuantity(item, 1)}
                          onDecrease={(item) => updateCartQuantity(item, -1)}
                          stopPropagation={true}
                        />
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Product Detail Modal */}
        {isModalOpen && selectedProduct && (
          <Modal isOpen={isModalOpen} onClose={closeProductModal}>
            <div className="relative h-64 w-full bg-gray-200 sm:h-80">
                  {selectedProduct.imageComingSoon ||
                  !selectedProduct.images?.length ||
                  imageErrors.has(selectedProduct._id) ? (
                    <ImageComingSoon />
                  ) : (
                    <>
                      <Image
                        src={selectedProduct.images[0]}
                        alt={selectedProduct.name}
                        fill
                        className="object-contain bg-white p-4"
                        unoptimized
                        onError={() => setImageErrors(prev => new Set(prev).add(selectedProduct._id))}
                      />
                      {selectedProduct.comingSoon && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 p-4">
                          <span className="text-center text-lg font-bold uppercase tracking-wide text-white">
                            Not yet available for purchase
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  {!selectedProduct.comingSoon && selectedProduct.inStoreOnly && (
                    <div className="absolute left-4 top-4 rounded-full bg-[var(--coffee-brown)]/90 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                      In store only
                    </div>
                  )}
                  <button
                    onClick={closeProductModal}
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

                <div className="p-6">
                  <h2 className="mb-2 text-3xl font-bold text-[var(--coffee-brown)]">
                    {selectedProduct.name}
                  </h2>
                  {selectedProduct.origin && (
                    <p className="mb-4 text-lg text-gray-600">
                      Origin: {selectedProduct.origin}
                    </p>
                  )}
                  <div className="mb-4 flex flex-wrap gap-2">
                    {selectedProduct.roastLevel && (
                      <span className="inline-block rounded-full bg-[var(--coffee-brown-light)] px-3 py-1 text-sm text-white">
                        {selectedProduct.roastLevel} Roast
                      </span>
                    )}
                    {selectedProduct.bagSize && (
                      <span className="inline-block rounded-full bg-[var(--lime-green)]/15 px-3 py-1 text-sm font-medium text-[var(--lime-green-dark)]">
                        {selectedProduct.bagSize}
                      </span>
                    )}
                  </div>
                  {selectedProduct.description && (
                    <p className="mb-4 text-gray-700">
                      {selectedProduct.description}
                    </p>
                  )}
                  {selectedProduct.flavorNotes &&
                    selectedProduct.flavorNotes.length > 0 && (
                      <div className="mb-4">
                        <h3 className="mb-2 font-semibold text-[var(--coffee-brown)]">
                          Flavor Notes:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedProduct.flavorNotes.map((note, idx) => (
                            <span
                              key={idx}
                              className="rounded-full bg-[var(--lime-green-light)] px-3 py-1 text-sm text-[var(--coffee-brown)]"
                            >
                              {note}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  {selectedProduct.categories &&
                    selectedProduct.categories.length > 0 && (
                      <div className="mb-4">
                        <h3 className="mb-2 font-semibold text-[var(--coffee-brown)]">
                          Categories:
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedProduct.categories.map((cat, idx) => (
                            <span
                              key={idx}
                              className="rounded-full bg-gray-200 px-3 py-1 text-sm text-[var(--coffee-brown)]"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div>
                      <p className="text-sm text-gray-600">Price</p>
                      <p className="text-3xl font-bold text-[var(--coffee-brown)] tabular-nums">
                        {formatProductPrice(selectedProduct)}
                      </p>
                      {selectedProduct.comingSoon ? (
                        <p className="mt-1 text-sm font-medium text-gray-600">
                          Not yet for sale
                        </p>
                      ) : selectedProduct.inStoreOnly ? (
                        <p className="mt-1 text-sm font-medium text-[var(--lime-green-dark)]">
                          Available in store · not sold online
                        </p>
                      ) : selectedProduct.inStock ? (
                        <p className="mt-1 text-sm text-[var(--lime-green)]">
                          ✓ In Stock
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-red-600">
                          Out of Stock
                        </p>
                      )}
                    </div>
                    {selectedProduct.comingSoon ? (
                      <span className="rounded-full bg-gray-300 px-8 py-3 text-lg font-semibold text-gray-600">
                        Coming Soon
                      </span>
                    ) : selectedProduct.inStoreOnly ? (
                      <Link
                        href="/location"
                        className="rounded-full bg-[var(--lime-green)] px-8 py-3 text-lg font-semibold text-white transition hover:bg-[var(--lime-green-dark)]"
                      >
                        Visit store
                      </Link>
                    ) : selectedProduct.inStock ? (
                      <AddToCartButton
                        item={selectedProduct}
                        quantity={getCartQuantity(selectedProduct._id)}
                        onAdd={addToCart}
                        onIncrease={(item) => updateCartQuantity(item, 1)}
                        onDecrease={(item) => updateCartQuantity(item, -1)}
                        className="px-8 py-3 text-lg"
                      />
                    ) : null}
                  </div>
                  <p className="mt-4 text-center text-sm text-gray-500">
                    {selectedProduct.inStoreOnly
                      ? "Pick up at 1532 Rockville Pike"
                      : "Available for in-store pickup"}
                  </p>
                </div>
          </Modal>
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
                {process.env.NEXT_PUBLIC_ONLINE_ORDERING_ENABLED === 'true' ? (
                  <Link
                    href="/order"
                    className="rounded-full bg-[var(--lime-green)] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--lime-green-dark)]"
                  >
                    Checkout
                  </Link>
                ) : (
                  <button
                    disabled
                    className="rounded-full bg-gray-400 px-6 py-2 text-sm font-semibold text-white cursor-not-allowed opacity-60"
                    title="Online ordering is temporarily unavailable"
                  >
                    Checkout (Unavailable)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

