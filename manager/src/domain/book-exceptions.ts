import { addDaysIso } from "@/lib/date-range";

export interface BookException {
  id: string;
  title: string;
  detail: string;
  href: string;
}

export function bookExceptions(input: {
  today: string;
  salesLast: string | null;
  expenseLast: string | null;
  salesLastLabel: string | null;
  expenseLastLabel: string | null;
  unnamedCount: number;
  productCount: number;
  previousPayrollPosted: boolean;
  previousPayrollLabel: string;
}): BookException[] {
  const items: BookException[] = [];
  const yesterday = addDaysIso(input.today, -1);

  if (!input.salesLast || input.salesLast < yesterday) {
    items.push({
      id: "sales-gap",
      title: "Register sales are behind",
      detail: input.salesLast
        ? `The last saved sales day is ${input.salesLastLabel ?? input.salesLast}. Yesterday is not in the book yet.`
        : "No register sales are saved for this store.",
      href: "/sales",
    });
  }

  if (input.expenseLast && input.salesLast && input.expenseLast < input.salesLast) {
    items.push({
      id: "bank-gap",
      title: "The bank book stops before sales",
      detail: `Bank lines run through ${input.expenseLastLabel ?? input.expenseLast}. Leftover does not include sales after that date.`,
      href: "/expenses",
    });
  }

  if (input.unnamedCount > 0) {
    items.push({
      id: "unnamed",
      title: "Some payments still need a payee",
      detail: `${input.unnamedCount} bank ${input.unnamedCount === 1 ? "line is" : "lines are"} unnamed or an unknown card purchase.`,
      href: "/expenses",
    });
  }

  if (!input.previousPayrollPosted) {
    items.push({
      id: "payroll",
      title: "Previous payroll is not posted",
      detail: `No posted labor cost covers ${input.previousPayrollLabel}.`,
      href: "/labor",
    });
  }

  if (input.productCount === 0) {
    items.push({
      id: "catalog",
      title: "The count sheet has no products",
      detail: "Post the store catalog before a count can start.",
      href: "/inventory",
    });
  }

  return items;
}
