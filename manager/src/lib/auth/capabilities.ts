export const managerRoles = [
  "owner",
  "manager",
  "inventory_counter",
  "purchaser",
  "accountant",
] as const;

export type ManagerRole = (typeof managerRoles)[number];

export const capabilities = [
  "dashboard:view",
  "purchase:capture",
  "purchase:review",
  "purchase:approve",
  "receiving:record",
  "inventory:count",
  "inventory:adjust",
  "inventory:view-cost",
  "waste:record",
  "documents:view-normal",
  "documents:view-confidential",
  "documents:view-restricted",
  "documents:delete",
  "bank:view",
  "payroll:view",
  "payroll:capture",
  "payroll:approve",
  "profit:view",
  "close:review",
  "close:lock",
  "close:reopen",
  "accounting:export",
  "users:manage",
] as const;

export type Capability = (typeof capabilities)[number];

const roleCapabilities = {
  owner: capabilities,
  manager: [
    "dashboard:view",
    "purchase:capture",
    "purchase:review",
    "receiving:record",
    "inventory:count",
    "inventory:adjust",
    "inventory:view-cost",
    "waste:record",
    "documents:view-normal",
  ],
  inventory_counter: [
    "inventory:count",
    "waste:record",
    "documents:view-normal",
  ],
  purchaser: [
    "purchase:capture",
    "purchase:review",
    "receiving:record",
    "inventory:view-cost",
    "documents:view-normal",
  ],
  accountant: [
    "dashboard:view",
    "inventory:view-cost",
    "documents:view-normal",
    "documents:view-confidential",
    "documents:view-restricted",
    "bank:view",
    "payroll:view",
    "payroll:capture",
    "payroll:approve",
    "profit:view",
    "close:review",
    "accounting:export",
  ],
} satisfies Record<ManagerRole, readonly Capability[]>;

export function hasCapability(
  role: ManagerRole,
  capability: Capability,
): boolean {
  const allowed: readonly Capability[] = roleCapabilities[role];
  return allowed.includes(capability);
}

export function capabilitiesFor(role: ManagerRole): readonly Capability[] {
  return roleCapabilities[role];
}
