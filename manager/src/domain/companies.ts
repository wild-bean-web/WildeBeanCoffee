import { z } from "zod";
import { managerRoles, type ManagerRole } from "@/lib/auth/capabilities";

const inviteRoles = [
  "manager",
  "purchaser",
  "inventory_counter",
  "accountant",
] as const satisfies readonly ManagerRole[];

export function companySlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "company";
}

const signupSchema = z.object({
  companyName: z.string().trim().min(2).max(80),
  locationName: z.string().trim().min(2).max(80),
  ownerName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(200),
  timezone: z.string().trim().min(1).max(64),
});

export type CompanySignup = z.infer<typeof signupSchema>;

export function parseCompanySignup(
  input: unknown,
): { ok: true; value: CompanySignup } | { ok: false; message: string } {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter the company, the first store, your name, email, and a password of at least 8 characters." };
  }
  return { ok: true, value: parsed.data };
}

const inviteSchema = z.object({
  email: z.string().trim().email().max(160),
  displayName: z.string().trim().min(2).max(80),
  role: z.enum(inviteRoles),
});

export type StaffInvite = z.infer<typeof inviteSchema>;

export function parseStaffInvite(
  input: unknown,
): { ok: true; value: StaffInvite } | { ok: false; message: string } {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Enter a name, a work email, and a role." };
  }
  return { ok: true, value: parsed.data };
}

export function roleLabel(role: string): string {
  return (managerRoles as readonly string[]).includes(role) ? role.replaceAll("_", " ") : role;
}
