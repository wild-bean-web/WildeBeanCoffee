"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { menuAdminApi } from "@/lib/api";
import { useConfirmAlert } from "@/context/ConfirmAlertContext";

function ToggleSwitch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-[var(--lime-green)]" : "bg-gray-300"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ItemRow({ item, savingKey, onToggle }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border-2 border-gray-200 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
        <p className="text-xs text-gray-500">
          {item.section || "Menu"} ·{" "}
          {item.available ? "In stock (online)" : "Out of stock (86'd)"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-medium text-gray-600">
          {item.available ? "In stock" : "Out"}
        </span>
        <ToggleSwitch
          checked={item.available}
          disabled={savingKey === `item-${item._id}`}
          label={`Toggle stock for ${item.name}`}
          onChange={() => onToggle(item)}
        />
      </div>
    </li>
  );
}

export default function KitchenAvailabilityPage() {
  const confirmAlert = useConfirmAlert();
  const [search, setSearch] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [menuItemMatches, setMenuItemMatches] = useState([]);
  const [selectionType, setSelectionType] = useState(null);
  const [selectedIngredient, setSelectedIngredient] = useState("");
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [dependents, setDependents] = useState(null);
  const [disabledItems, setDisabledItems] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingDisabled, setLoadingDisabled] = useState(false);
  const [loadingDependents, setLoadingDependents] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [error, setError] = useState("");

  const loadSearchResults = useCallback(async (query) => {
    setLoadingSearch(true);
    setError("");
    try {
      const data = await menuAdminApi.search(query);
      setIngredients(data.ingredients || []);
      setMenuItemMatches(data.menuItems || []);
    } catch (err) {
      setError(err.message || "Failed to load search results");
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  const loadDisabledItems = useCallback(async () => {
    setLoadingDisabled(true);
    try {
      const data = await menuAdminApi.listUnavailable();
      setDisabledItems(data);
    } catch (err) {
      setError(err.message || "Failed to load out-of-stock items");
    } finally {
      setLoadingDisabled(false);
    }
  }, []);

  const loadDependents = useCallback(async (ingredient) => {
    if (!ingredient) {
      setDependents(null);
      return;
    }
    setLoadingDependents(true);
    setError("");
    try {
      const data = await menuAdminApi.getDependents(ingredient);
      setDependents(data);
    } catch (err) {
      setError(err.message || "Failed to load dependent items");
    } finally {
      setLoadingDependents(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSearchResults(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, loadSearchResults]);

  useEffect(() => {
    loadDisabledItems();
  }, [loadDisabledItems]);

  useEffect(() => {
    if (selectionType === "ingredient" && selectedIngredient) {
      loadDependents(selectedIngredient);
    }
  }, [selectionType, selectedIngredient, loadDependents]);

  const dependentItems = dependents?.menuItems || [];
  const allItemsInStock = useMemo(
    () => dependentItems.length > 0 && dependentItems.every((item) => item.available),
    [dependentItems],
  );

  const hasSearchResults = ingredients.length > 0 || menuItemMatches.length > 0;
  const hasSearchQuery = search.trim().length > 0;

  const handleClear = () => {
    setSearch("");
    setSelectionType(null);
    setSelectedIngredient("");
    setSelectedMenuItem(null);
    setDependents(null);
    setError("");
    loadSearchResults("");
  };

  const handleSelectIngredient = (name) => {
    setSelectionType("ingredient");
    setSelectedIngredient(name);
    setSelectedMenuItem(null);
    setSearch(name);
  };

  const handleSelectMenuItem = (item) => {
    setSelectionType("menuItem");
    setSelectedMenuItem(item);
    setSelectedIngredient("");
    setDependents(null);
    setSearch(item.name);
  };

  const refreshAfterToggle = (updated) => {
    loadDisabledItems();
    if (search.trim()) loadSearchResults(search);
    if (selectionType === "ingredient" && selectedIngredient) {
      loadDependents(selectedIngredient);
    }
    if (selectionType === "menuItem" && selectedMenuItem?._id === updated._id) {
      setSelectedMenuItem(updated);
    }
  };

  const handleToggleItem = async (item) => {
    const markingOut = item.available;
    const confirmed = await confirmAlert(
      markingOut
        ? {
            title: "Mark out of stock?",
            message: `Mark "${item.name}" out of stock (86)?\n\nCustomers will not be able to order it online until you turn it back on.`,
            confirmLabel: "Mark out of stock",
            variant: "warning",
          }
        : {
            title: "Mark back in stock?",
            message: `Mark "${item.name}" back in stock?\n\nCustomers will be able to order it online again.`,
            confirmLabel: "Mark in stock",
            variant: "success",
          },
    );
    if (!confirmed) return;

    setSavingKey(`item-${item._id}`);
    setError("");
    try {
      const updated = await menuAdminApi.setItemAvailable(item._id, !item.available);
      refreshAfterToggle(updated);
    } catch (err) {
      setError(err.message || "Failed to update item availability");
    } finally {
      setSavingKey("");
    }
  };

  const handleBulkEnableDisabled = async () => {
    if (!disabledItems.length) return;
    const confirmed = await confirmAlert({
      title: "Mark all back in stock?",
      message: `Mark all ${disabledItems.length} out-of-stock items back in stock?\n\nCustomers will be able to order them online again.`,
      confirmLabel: "Mark all in stock",
      variant: "success",
    });
    if (!confirmed) return;

    setSavingKey("bulk-disabled");
    setError("");
    try {
      await menuAdminApi.bulkSetItemsAvailable(
        disabledItems.map((item) => item._id),
        true,
      );
      loadDisabledItems();
      if (search.trim()) loadSearchResults(search);
      if (selectionType === "ingredient" && selectedIngredient) {
        loadDependents(selectedIngredient);
      }
      if (selectionType === "menuItem" && selectedMenuItem) {
        setSelectedMenuItem({ ...selectedMenuItem, available: true });
      }
    } catch (err) {
      setError(err.message || "Failed to re-enable items");
    } finally {
      setSavingKey("");
    }
  };

  const handleBulkToggleItems = async (available) => {
    if (!dependentItems.length) return;
    const confirmed = await confirmAlert(
      available
        ? {
            title: "Mark all back in stock?",
            message: `Mark all ${dependentItems.length} items back in stock?\n\nCustomers will be able to order them online again.`,
            confirmLabel: "Mark all in stock",
            variant: "success",
          }
        : {
            title: "Mark all out of stock?",
            message: `Mark all ${dependentItems.length} items out of stock (86)?\n\nCustomers will not be able to order them online until you turn them back on.`,
            confirmLabel: "Mark all out of stock",
            variant: "warning",
          },
    );
    if (!confirmed) return;

    setSavingKey("bulk-items");
    setError("");
    try {
      await menuAdminApi.bulkSetItemsAvailable(
        dependentItems.map((item) => item._id),
        available,
      );
      loadDisabledItems();
      if (search.trim()) loadSearchResults(search);
      loadDependents(selectedIngredient);
    } catch (err) {
      setError(err.message || "Failed to bulk update items");
    } finally {
      setSavingKey("");
    }
  };

  const displayIngredient =
    dependents?.canonicalIngredient || selectedIngredient;

  return (
    <div className="min-h-screen bg-[var(--coffee-brown-very-light)]">
      <div className="bg-[var(--coffee-brown)] px-4 py-5 text-white sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white/75">Kitchen Admin</p>
            <h1 className="text-2xl font-bold sm:text-3xl">Menu Availability</h1>
            <p className="mt-1 text-sm text-white/80">
              Search by menu item or ingredient to mark items out of stock for
              customers online.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/25"
            >
              Clear
            </button>
            <Link
              href="/kitchen"
              className="rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/25"
            >
              Back to Kitchen
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Currently out of stock (86&apos;d)
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                These items are hidden from online ordering. Toggle them back on
                when they are available again.
              </p>
            </div>
            {disabledItems.length > 1 && (
              <button
                type="button"
                disabled={savingKey === "bulk-disabled"}
                onClick={handleBulkEnableDisabled}
                className="rounded-lg bg-[var(--coffee-brown)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--coffee-brown-dark)] disabled:opacity-50"
              >
                Mark all in stock
              </button>
            )}
          </div>

          {loadingDisabled ? (
            <p className="mt-4 text-sm text-gray-500">Loading...</p>
          ) : disabledItems.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">
              No menu items are currently 86&apos;d.
            </p>
          ) : (
            <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto">
              {disabledItems.map((item) => (
                <ItemRow
                  key={item._id}
                  item={item}
                  savingKey={savingKey}
                  onToggle={handleToggleItem}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <label
            htmlFor="availability-search"
            className="block text-base font-semibold text-gray-900"
          >
            Search menu items or ingredients
          </label>
          <p className="mt-1 text-sm text-gray-500">
            Example: Green Glow, Spinach, Strawberry Puree, Matcha
          </p>
          <input
            id="availability-search"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!e.target.value.trim()) {
                setSelectionType(null);
                setSelectedIngredient("");
                setSelectedMenuItem(null);
                setDependents(null);
              }
            }}
            placeholder="Start typing a menu item or ingredient..."
            className="mt-3 w-full rounded-lg border-2 border-gray-200 px-4 py-3 text-sm focus:border-[var(--lime-green)] focus:outline-none"
          />

          <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-gray-200">
            {loadingSearch ? (
              <p className="px-4 py-3 text-sm text-gray-500">Loading...</p>
            ) : !hasSearchQuery ? (
              <p className="px-4 py-3 text-sm text-gray-500">
                Type a menu item or ingredient to search.
              </p>
            ) : !hasSearchResults ? (
              <p className="px-4 py-3 text-sm text-gray-500">
                No menu items or ingredients match your search.
              </p>
            ) : (
              <>
                {menuItemMatches.length > 0 && (
                  <div>
                    <p className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Menu items
                    </p>
                    {menuItemMatches.map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => handleSelectMenuItem(item)}
                        className={`flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50 ${
                          selectionType === "menuItem" &&
                          selectedMenuItem?._id === item._id
                            ? "bg-[var(--lime-green)]/10"
                            : ""
                        }`}
                      >
                        <span className="font-medium text-gray-900">{item.name}</span>
                        <span className="text-xs text-gray-500">
                          {item.section || "Menu"} ·{" "}
                          {item.available ? "In stock" : "Out"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {ingredients.length > 0 && (
                  <div>
                    <p className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Ingredients
                    </p>
                    {ingredients.map((entry) => (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => handleSelectIngredient(entry.name)}
                        className={`flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-gray-50 ${
                          selectionType === "ingredient" &&
                          selectedIngredient === entry.name
                            ? "bg-[var(--lime-green)]/10"
                            : ""
                        }`}
                      >
                        <span className="font-medium text-gray-900">{entry.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {selectionType === "menuItem" && selectedMenuItem && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedMenuItem.name}
              </h2>
              <p className="text-sm text-gray-600">
                Toggle this item off to mark it out of stock — customers won&apos;t
                be able to order it online.
              </p>
            </div>
            <ul className="mt-4 space-y-3">
              <ItemRow
                item={selectedMenuItem}
                savingKey={savingKey}
                onToggle={handleToggleItem}
              />
            </ul>
          </section>
        )}

        {selectionType === "ingredient" && selectedIngredient && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            {loadingDependents ? (
              <p className="text-sm text-gray-500">Loading dependent items...</p>
            ) : (
              <>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {displayIngredient}
                  </h2>
                  <p className="text-sm text-gray-600">
                    The following menu items are made with &quot;
                    {displayIngredient}&quot;. Toggle them off to mark them out
                    of stock — customers won&apos;t be able to order them online.
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-900">
                    Affected items ({dependentItems.length})
                  </p>
                  {dependentItems.length > 0 && (
                    <button
                      type="button"
                      disabled={savingKey === "bulk-items"}
                      onClick={() => handleBulkToggleItems(!allItemsInStock)}
                      className="rounded-lg bg-[var(--coffee-brown)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--coffee-brown-dark)] disabled:opacity-50"
                    >
                      {allItemsInStock
                        ? "Mark all out of stock"
                        : "Mark all in stock"}
                    </button>
                  )}
                </div>

                {dependentItems.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">
                    No menu items in our recipe database are made with this
                    ingredient.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {dependentItems.map((item) => (
                      <ItemRow
                        key={item._id}
                        item={item}
                        savingKey={savingKey}
                        onToggle={handleToggleItem}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
