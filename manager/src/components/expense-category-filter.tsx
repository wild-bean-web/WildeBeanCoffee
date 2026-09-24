"use client";

import { useRouter } from "next/navigation";
import { expenseSearchParams, type ExpenseGroup } from "@/domain/expenses/ledger";

export function ExpenseCategoryFilter({
  categories,
  value,
  from,
  to,
  group,
}: {
  categories: string[];
  value: string;
  from: string;
  to: string;
  group: ExpenseGroup | "all";
}) {
  const router = useRouter();

  return (
    <label className="expense-category-filter">
      <span>Category</span>
      <select
        className="input"
        value={value}
        aria-label="Filter posted lines by category"
        onChange={(event) => {
          const query = expenseSearchParams({
            from,
            to,
            group,
            category: event.target.value,
          });
          router.push(query ? `/expenses?${query}` : "/expenses");
        }}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </label>
  );
}
