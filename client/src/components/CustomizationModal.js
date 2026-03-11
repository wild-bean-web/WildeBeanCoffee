"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

/**
 * CustomizationModal - Modern customization modal for menu items with modifiers
 *
 * Features:
 * - Mobile-first responsive design
 * - Real-time price calculation
 * - Smooth animations
 * - Clear visual hierarchy
 * - Required vs optional indicators
 * - Disabled option handling
 */

// Predetermined modifier selections for fixed bowls (users can still remove/add within rules)
const PREDETERMINED_BOWL_DEFAULTS = {
  "Wild Vegan": {
    "Wild Vegan Base": ["Chia Seeds Pudding"],
    "Oatmeal Bowl Size": ["Small (12oz)"],
    "Oatmeal Dried Toppings": [
      "Granola",
      "Coconut flakes",
      "Sliced almonds",
      "Dried cranberries",
    ],
    "Oatmeal Drizzels": ["Peanut Butter", "Honey"],
    "Oatmeal Fruit Toppings": ["Strawberries", "Bananas"],
    "Oatmeal EXTRA Add-Ons": [],
  },
  "Signature Bowl": {
    "Oatmeal Base": ["Chia Seeds Pudding & Yogurt"],
    "Oatmeal Bowl Size": ["Small (12oz)"],
    "Oatmeal Dried Toppings": [
      "Granola",
      "Chopped pecans",
      "Sunflower Seeds",
      "Coconut flakes",
    ],
    "Oatmeal Drizzels": ["Peanut Butter", "Honey"],
    "Oatmeal Fruit Toppings": ["Strawberries", "Blueberries"],
    "Oatmeal EXTRA Add-Ons": [],
  },
};

export default function CustomizationModal({
  isOpen,
  onClose,
  menuItem,
  onAddToCart,
  existingCartItem = null, // If editing existing cart item
}) {
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [modifierQuantities, setModifierQuantities] = useState({}); // Store quantities for each selected option
  const [validationErrors, setValidationErrors] = useState({});

  // Initialize modifiers from existing cart item or reset with defaults
  useEffect(() => {
    if (isOpen) {
      if (existingCartItem?.modifiers) {
        // Restore modifiers from existing cart item
        const restored = {};
        const restoredQuantities = {};
        existingCartItem.modifiers.forEach((mod) => {
          restored[mod.modifierGroupName] = mod.selectedOptions.map(
            (opt) => opt.name,
          );
          mod.selectedOptions.forEach((opt) => {
            const key = `${mod.modifierGroupName}_${opt.name}`;
            restoredQuantities[key] = opt.quantity || 1;
          });
        });
        setSelectedModifiers(restored);
        setModifierQuantities(restoredQuantities);
      } else {
        // Reset for new item and set default selections
        const defaults = {};
        const defaultQuantities = {};

        if (menuItem?.modifierGroups) {
          menuItem.modifierGroups.forEach((group) => {
            if (!group.options || group.options.length === 0) return;

            // Find the default option based on group name and option name
            let defaultOption = null;

            if (
              group.name === "Cup Size (16-20)" ||
              group.name === "Cold Brew Cup Size (16-20)"
            ) {
              defaultOption = group.options.find(
                (opt) => opt.name === "Medium (16oz)" && opt.available,
              );
            } else if (group.name === "Cup Size (12-16)") {
              defaultOption = group.options.find(
                (opt) => opt.name === "Small (12oz)" && opt.available,
              );
            } else if (group.name === "Ice Level") {
              defaultOption = group.options.find(
                (opt) => opt.name === "Regular Ice" && opt.available,
              );
            } else if (
              group.name === "Milk Choice" ||
              group.name === "Milk Choice (Smoothies)"
            ) {
              defaultOption = group.options.find(
                (opt) => opt.name === "Whole Milk" && opt.available,
              );
            } else if (group.name === "Yogurt Choice") {
              defaultOption = group.options.find(
                (opt) => opt.name === "Regular Yogurt" && opt.available,
              );
            } else if (group.name === "Wild Vegan Base") {
              defaultOption = group.options.find(
                (opt) => opt.name === "Chia Seeds Pudding" && opt.available,
              );
            } else if (group.name === "Oatmeal Bowl Size") {
              defaultOption = group.options.find(
                (opt) => opt.name === "Small (12oz)" && opt.available,
              );
            } else if (group.name === "Smoothie Size") {
              defaultOption = group.options.find(
                (opt) => opt.name === "16oz" && opt.available !== false,
              );
            } else if (group.name === "Protein Powder") {
              defaultOption = group.options.find(
                (opt) =>
                  opt.name === "Vanilla Mass protein powder" && opt.available,
              );
            }

            // If a default option is found and the group is required, set it
            if (defaultOption && group.required) {
              defaults[group.name] = [defaultOption.name];
            }
          });

          // Override with predetermined bowl defaults for Wild Vegan and Signature Bowl
          if (menuItem?.name && PREDETERMINED_BOWL_DEFAULTS[menuItem.name]) {
            const preset = PREDETERMINED_BOWL_DEFAULTS[menuItem.name];
            const groupNames = (menuItem.modifierGroups || []).map(
              (g) => g.name,
            );
            groupNames.forEach((groupName) => {
              if (Array.isArray(preset[groupName])) {
                defaults[groupName] = preset[groupName];
              }
            });
          }

          // Pre-select Protein Powder for protein smoothies (Berry Mango Tango, Power Couple)
          if (
            (menuItem?.name === "Berry Mango Tango" ||
              menuItem?.name === "Power Couple") &&
            (menuItem.modifierGroups || []).some(
              (g) => g.name === "Protein Powder",
            )
          ) {
            defaults["Protein Powder"] = ["Vanilla Mass protein powder"];
          }
        }

        setSelectedModifiers(defaults);
        setModifierQuantities(defaultQuantities);
      }
      setValidationErrors({});
    }
  }, [isOpen, existingCartItem, menuItem]);

  // Ensure Smoothie Size defaults to 16oz when modal opens for a smoothie (fallback if initial defaults ran before groups loaded)
  useEffect(() => {
    if (!isOpen || !menuItem?.modifierGroups) return;
    const smoothieSizeGroup = menuItem.modifierGroups.find(
      (g) => g.name === "Smoothie Size",
    );
    if (!smoothieSizeGroup?.required) return;
    const current = selectedModifiers["Smoothie Size"] || [];
    if (current.length > 0) return;
    const has16oz = smoothieSizeGroup.options?.some(
      (o) => o.name === "16oz" && o.available !== false,
    );
    if (has16oz) {
      setSelectedModifiers((prev) => ({ ...prev, "Smoothie Size": ["16oz"] }));
    }
  }, [isOpen, menuItem]);

  // Check if a modifier group supports quantities (like Syrup Pumps)
  const isQuantityBased = (groupName) => {
    return (
      groupName.includes("Syrup Pumps") ||
      groupName.includes("Pumps") ||
      groupName.includes("Extra Single Shot")
    );
  };

  // Calculate total price including modifiers
  const totalPrice = useMemo(() => {
    if (!menuItem) return 0;

    let basePrice = menuItem.price || 0;
    let modifierTotal = 0;

    // Calculate modifier costs
    if (menuItem.modifierGroups && Array.isArray(menuItem.modifierGroups)) {
      menuItem.modifierGroups.forEach((group) => {
        if (!group.options) return;

        const selected = selectedModifiers[group.name] || [];
        selected.forEach((selectedOptionName) => {
          const option = group.options.find(
            (opt) => opt.name === selectedOptionName,
          );
          if (option && option.available) {
            const quantityKey = `${group.name}_${selectedOptionName}`;
            const quantity = isQuantityBased(group.name)
              ? modifierQuantities[quantityKey] || 1
              : 1;
            modifierTotal += (option.price || 0) * quantity;
          }
        });
      });
    }

    return basePrice + modifierTotal;
  }, [menuItem, selectedModifiers, modifierQuantities]);

  // Derive whether current selection meets all required modifier rules (for disabling Add to Cart)
  const canAddToCart = useMemo(() => {
    if (!menuItem?.modifierGroups) return true;
    for (const group of menuItem.modifierGroups) {
      if (!group.required) continue;
      const selected = selectedModifiers[group.name] || [];
      if (group.type === "single") {
        if (selected.length === 0) return false;
      } else if (group.type === "multiple") {
        const minSelections = group.minSelections ?? 0;
        if (selected.length < minSelections) return false;
      }
    }
    return true;
  }, [menuItem, selectedModifiers]);

  // Validate required modifiers
  const validateModifiers = () => {
    const errors = {};

    if (!menuItem?.modifierGroups) return true;

    menuItem.modifierGroups.forEach((group) => {
      if (group.required) {
        const selected = selectedModifiers[group.name] || [];
        if (group.type === "single") {
          if (selected.length === 0) {
            errors[group.name] = `${group.name} is required`;
          }
        } else if (group.type === "multiple") {
          const minSelections = group.minSelections || 0;
          if (selected.length < minSelections) {
            errors[group.name] =
              `Please select at least ${minSelections} option(s)`;
          }
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle modifier selection
  const handleModifierChange = (
    groupName,
    optionName,
    groupType,
    maxSelections,
    isRequired = false,
  ) => {
    setSelectedModifiers((prev) => {
      const current = prev[groupName] || [];

      if (groupType === "single") {
        // Single selection (radio)
        // If optional and already selected, allow deselecting
        if (!isRequired && current.includes(optionName)) {
          // Deselect - also remove quantity
          const quantityKey = `${groupName}_${optionName}`;
          setModifierQuantities((prevQty) => {
            const updated = { ...prevQty };
            delete updated[quantityKey];
            return updated;
          });
          return { ...prev, [groupName]: [] };
        }
        // Otherwise, select the option
        return { ...prev, [groupName]: [optionName] };
      } else {
        // Multiple selection (checkbox)
        if (current.includes(optionName)) {
          // Deselect - also remove quantity
          const quantityKey = `${groupName}_${optionName}`;
          setModifierQuantities((prevQty) => {
            const updated = { ...prevQty };
            delete updated[quantityKey];
            return updated;
          });
          return {
            ...prev,
            [groupName]: current.filter((name) => name !== optionName),
          };
        } else {
          // Check max selections
          if (maxSelections && current.length >= maxSelections) {
            return prev; // Don't add if max reached
          }
          // Initialize quantity to 1 for quantity-based modifiers
          if (isQuantityBased(groupName)) {
            const quantityKey = `${groupName}_${optionName}`;
            setModifierQuantities((prevQty) => ({
              ...prevQty,
              [quantityKey]: 1,
            }));
          }
          return { ...prev, [groupName]: [...current, optionName] };
        }
      }
    });

    // Clear validation error for this group
    if (validationErrors[groupName]) {
      setValidationErrors((prev) => {
        const updated = { ...prev };
        delete updated[groupName];
        return updated;
      });
    }
  };

  // Handle quantity change for quantity-based modifiers
  const handleQuantityChange = (groupName, optionName, change) => {
    const quantityKey = `${groupName}_${optionName}`;
    const current = modifierQuantities[quantityKey] || 1;
    const newQuantity = current + change;

    if (newQuantity < 1) {
      // Auto-deselect: remove option and clear quantity
      setSelectedModifiers((prev) => {
        const groupSelected = prev[groupName] || [];
        return {
          ...prev,
          [groupName]: groupSelected.filter((name) => name !== optionName),
        };
      });
      setModifierQuantities((prev) => {
        const updated = { ...prev };
        delete updated[quantityKey];
        return updated;
      });
      return;
    }

    setModifierQuantities((prev) => ({
      ...prev,
      [quantityKey]: Math.min(10, newQuantity),
    }));
  };

  // Handle add to cart
  const handleAddToCart = () => {
    if (!validateModifiers()) {
      return;
    }

    // Format modifiers for cart
    const formattedModifiers = [];
    let modifierTotal = 0;

    if (menuItem.modifierGroups) {
      menuItem.modifierGroups.forEach((group) => {
        const selected = selectedModifiers[group.name] || [];
        if (selected.length > 0) {
          const selectedOptions = [];
          selected.forEach((optionName) => {
            const option = group.options.find((opt) => opt.name === optionName);
            if (option && option.available) {
              const quantityKey = `${group.name}_${optionName}`;
              const quantity = isQuantityBased(group.name)
                ? modifierQuantities[quantityKey] || 1
                : 1;
              const optionPrice = (option.price || 0) * quantity;

              selectedOptions.push({
                name: option.name,
                price: option.price || 0, // Base price per unit
                quantity: quantity,
              });
              modifierTotal += optionPrice;
            }
          });

          if (selectedOptions.length > 0) {
            formattedModifiers.push({
              modifierGroupName: group.name,
              selectedOptions,
            });
          }
        }
      });
    }

    const cartItem = {
      ...menuItem,
      quantity: existingCartItem?.quantity || 1,
      itemType: "menu",
      modifiers: formattedModifiers,
      modifierTotal,
      // Create a unique key for items with different modifiers
      cartKey: `${menuItem._id}_${JSON.stringify(formattedModifiers)}`,
    };

    onAddToCart(cartItem);
    onClose();
  };

  if (!isOpen || !menuItem) return null;

  const modifierGroups = menuItem.modifierGroups || [];

  // Sort modifier groups: required first, then optional
  const sortedModifierGroups = [...modifierGroups].sort((a, b) => {
    // Required groups come first
    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    // If both have same required status, maintain original order
    return 0;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 z-10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    {menuItem.name}
                  </h2>
                  {menuItem.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {menuItem.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="ml-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Close"
                >
                  <svg
                    className="w-6 h-6 text-gray-500"
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
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {/* Image (if available) */}
              {menuItem.image && (
                <div className="relative h-48 w-full mb-6 rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={menuItem.image}
                    alt={menuItem.name}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              )}

              {/* Modifier Groups */}
              {sortedModifierGroups.length > 0 ? (
                <div className="space-y-6">
                  {sortedModifierGroups.map((group) => {
                    const selected = selectedModifiers[group.name] || [];
                    const hasError = validationErrors[group.name];
                    const availableOptions = (group.options || []).filter(
                      (opt) => opt.available,
                    );
                    const isWildVeganBase = group.name === "Wild Vegan Base";

                    return (
                      <div key={group._id || group.name} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-base font-semibold text-gray-900">
                            {group.displayName || group.name}
                            {group.required && !isWildVeganBase && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </label>
                          {group.description && !isWildVeganBase && (
                            <span className="text-xs text-gray-500">
                              {group.description}
                            </span>
                          )}
                        </div>

                        {isWildVeganBase ? (
                          <div className="rounded-lg border-2 border-[var(--lime-green)]/30 bg-[var(--lime-green)]/5 p-4">
                            <p className="text-sm font-medium text-gray-800">
                              This bowl comes with{" "}
                              <span className="font-semibold text-[var(--coffee-brown)]">
                                Chia Seed Pudding
                              </span>{" "}
                              (made with plant-based almond milk).
                            </p>
                          </div>
                        ) : (
                          <>
                            {hasError && (
                              <p className="text-sm text-red-500">{hasError}</p>
                            )}

                            <div className="space-y-2">
                              {availableOptions.map((option) => {
                                const isSelected = selected.includes(
                                  option.name,
                                );
                                const isDisabled = !option.available;
                                const optionPrice = option.price || 0;
                                const quantityKey = `${group.name}_${option.name}`;
                                const quantity =
                                  isQuantityBased(group.name) && isSelected
                                    ? modifierQuantities[quantityKey] || 1
                                    : 1;
                                const totalOptionPrice = optionPrice * quantity;

                                return (
                                  <motion.div
                                    key={option._id || option.name}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => {
                                      if (
                                        !isDisabled &&
                                        group.type === "single"
                                      ) {
                                        // For radio buttons, clicking the row selects/deselects it (if optional)
                                        handleModifierChange(
                                          group.name,
                                          option.name,
                                          group.type,
                                          group.maxSelections,
                                          group.required,
                                        );
                                      } else if (
                                        !isDisabled &&
                                        group.type === "multiple"
                                      ) {
                                        // For checkboxes, clicking the row toggles it
                                        handleModifierChange(
                                          group.name,
                                          option.name,
                                          group.type,
                                          group.maxSelections,
                                          group.required,
                                        );
                                      }
                                    }}
                                    className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                                      isSelected
                                        ? "border-[var(--lime-green)] bg-[var(--lime-green)]/5"
                                        : "border-gray-200 hover:border-gray-300"
                                    } ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                  >
                                    <div className="flex items-center flex-1">
                                      {group.type === "single" ? (
                                        <input
                                          type="radio"
                                          name={group.name}
                                          value={option.name}
                                          checked={isSelected}
                                          onChange={() =>
                                            !isDisabled &&
                                            handleModifierChange(
                                              group.name,
                                              option.name,
                                              group.type,
                                              group.maxSelections,
                                              group.required,
                                            )
                                          }
                                          onClick={(e) => e.stopPropagation()} // Prevent row click when clicking input directly
                                          disabled={isDisabled}
                                          className="w-5 h-5 text-[var(--lime-green)] focus:ring-[var(--lime-green)] cursor-pointer pointer-events-auto"
                                        />
                                      ) : (
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() =>
                                            !isDisabled &&
                                            handleModifierChange(
                                              group.name,
                                              option.name,
                                              group.type,
                                              group.maxSelections,
                                              group.required,
                                            )
                                          }
                                          onClick={(e) => e.stopPropagation()} // Prevent row click when clicking input directly
                                          disabled={isDisabled}
                                          className="w-5 h-5 text-[var(--lime-green)] rounded focus:ring-[var(--lime-green)] cursor-pointer pointer-events-auto"
                                        />
                                      )}
                                      <span className="ml-3 text-sm font-medium text-gray-900">
                                        {option.name
                                          .replace(/\(Disabled\)/g, "")
                                          .trim()}
                                      </span>
                                    </div>

                                    {/* Quantity Selector for quantity-based modifiers */}
                                    {isQuantityBased(group.name) &&
                                      isSelected && (
                                        <div className="flex items-center gap-2 mx-3">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleQuantityChange(
                                                group.name,
                                                option.name,
                                                -1,
                                              );
                                            }}
                                            className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-[var(--lime-green)] hover:bg-[var(--lime-green)]/10 transition-colors"
                                            aria-label="Decrease quantity"
                                          >
                                            <svg
                                              className="w-4 h-4 text-gray-600"
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
                                          <span className="min-w-[5rem] text-center text-sm font-semibold text-gray-900">
                                            {quantity === 1
                                              ? "1 pump"
                                              : `${quantity} pumps`}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleQuantityChange(
                                                group.name,
                                                option.name,
                                                1,
                                              );
                                            }}
                                            className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-[var(--lime-green)] hover:bg-[var(--lime-green)]/10 transition-colors"
                                            aria-label="Increase quantity"
                                          >
                                            <svg
                                              className="w-4 h-4 text-gray-600"
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
                                      )}

                                    {/* Price Display */}
                                    <div className="text-right">
                                      {optionPrice > 0 ? (
                                        <div className="flex flex-col items-end">
                                          <span className="text-sm font-semibold text-gray-700">
                                            {isQuantityBased(group.name) &&
                                            isSelected
                                              ? `+${formatPrice(totalOptionPrice)}`
                                              : `+${formatPrice(optionPrice)}`}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-sm text-gray-500">
                                          Free
                                        </span>
                                      )}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>

                            {group.type === "multiple" &&
                              group.maxSelections &&
                              availableOptions.length >= 2 && (
                                <p className="text-xs text-gray-500">
                                  Select up to {group.maxSelections} option(s)
                                </p>
                              )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No customization options available for this item.
                </p>
              )}

              {/* Allergen Information */}
              {menuItem.allergens && menuItem.allergens.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    Allergens:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {menuItem.allergens.map((allergen, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-amber-100 text-amber-800 text-xs rounded-full"
                      >
                        {allergen}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    For awareness only. Cross-contamination may occur. See{" "}
                    <a href="/terms" className="underline hover:text-gray-700">
                      Terms of Use
                    </a>
                    .
                  </p>
                </div>
              )}

              {/* Wild Bowl / Build Your Own Bowl – subtle warning (shown when item has no allergen list) */}
              {(menuItem.name === "Build Your Own Bowl" ||
                menuItem.name === "Wild Vegan" ||
                menuItem.name === "Signature Bowl") &&
                (!menuItem.allergens || menuItem.allergens.length === 0) && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Allergen info for add-ons varies. Cross-contamination may
                      occur. See{" "}
                      <a
                        href="/terms"
                        className="underline hover:text-gray-700"
                      >
                        Terms of Use
                      </a>
                      .
                    </p>
                  </div>
                )}
            </div>

            {/* Footer - Sticky */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-gray-900">
                  Total:
                </span>
                <span className="text-2xl font-bold text-[var(--lime-green)]">
                  {formatPrice(totalPrice)}
                </span>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={!canAddToCart}
                className="w-full rounded-lg bg-[var(--lime-green)] px-6 py-3 text-white font-semibold hover:bg-[var(--lime-green-dark)] transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {existingCartItem ? "Update Cart" : "Add to Cart"}
              </button>
              {!canAddToCart &&
                !menuItem?.modifierGroups?.some(
                  (g) => g.name === "Smoothie Size",
                ) && (
                  <p className="mt-2 text-center text-sm text-amber-700">
                    {menuItem?.name === "Build Your Own Bowl" ||
                    menuItem?.name === "Wild Vegan" ||
                    menuItem?.name === "Signature Bowl"
                      ? "Please meet all requirements above (base, dried toppings, fruits) to add to cart."
                      : "Please complete the required options above to add to cart."}
                  </p>
                )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatPrice(price) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}
