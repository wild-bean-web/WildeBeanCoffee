"use client";

import {
  BarChart3,
  ClipboardCheck,
  FileText,
  Landmark,
  Menu,
  PackageSearch,
  PieChart,
  ReceiptText,
  Scale,
  ScanLine,
  Settings,
  ShoppingBasket,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { LocationSwitcher } from "@/components/location-switcher";
import {
  hasCapability,
  type Capability,
  type ManagerRole,
} from "@/lib/auth/capabilities";
import type { ManagerLocation } from "@/lib/location";

interface AppShellProps {
  children: ReactNode;
  displayName: string;
  role: ManagerRole;
  isDemo?: boolean;
  locations?: ManagerLocation[];
  activeLocationId?: string | null;
}

interface NavigationItem {
  href: string;
  label: string;
  icon: typeof BarChart3;
  capability: Capability;
}

const navigation: NavigationItem[] = [
  {
    href: "/overview",
    label: "Overview",
    icon: BarChart3,
    capability: "dashboard:view",
  },
  {
    href: "/purchases",
    label: "Purchases",
    icon: ReceiptText,
    capability: "purchase:capture",
  },
  {
    href: "/documents",
    label: "Document inbox",
    icon: FileText,
    capability: "documents:view-normal",
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: PackageSearch,
    capability: "inventory:count",
  },
  {
    href: "/sales",
    label: "Sales",
    icon: ShoppingBasket,
    capability: "dashboard:view",
  },
  {
    href: "/labor",
    label: "Labor",
    icon: Users,
    capability: "payroll:view",
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: PieChart,
    capability: "bank:view",
  },
  {
    href: "/pnl",
    label: "P&L",
    icon: Scale,
    capability: "profit:view",
  },
  {
    href: "/profit",
    label: "Prime cost",
    icon: Landmark,
    capability: "profit:view",
  },
  {
    href: "/close",
    label: "Monthly close",
    icon: ClipboardCheck,
    capability: "close:review",
  },
];

function roleLabel(role: ManagerRole): string {
  return role
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function AppShell({
  children,
  displayName,
  role,
  isDemo = false,
  locations = [],
  activeLocationId = null,
}: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleNavigation = navigation.filter((item) =>
    hasCapability(role, item.capability),
  );

  const navigationLinks = (
    <>
      {visibleNavigation.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            className={`nav-link ${active ? "nav-link-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="manager-shell">
      <aside className="sidebar" aria-label="Manager navigation">
        <div className="brand-lockup">
          <BrandMark />
          <div>
            <p className="brand-name">Wild Bean</p>
            <p className="brand-subtitle">Manager</p>
          </div>
        </div>

        <LocationSwitcher
          locations={locations}
          activeLocationId={activeLocationId}
          canCreate={hasCapability(role, "users:manage")}
        />

        <nav className="sidebar-nav">{navigationLinks}</nav>

        <div className="sidebar-footer">
          <div className="user-avatar" aria-hidden="true">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="truncate text-xs text-muted">
              {roleLabel(role)}
              {isDemo ? " · Preview" : ""}
            </p>
          </div>
          <Link
            href="/settings"
            className="icon-button ml-auto"
            aria-label="Store setup"
          >
            <Settings size={18} aria-hidden="true" />
          </Link>
        </div>
      </aside>

      <header className="mobile-header">
        <button
          type="button"
          className="icon-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className="brand-lockup brand-lockup-mobile">
          <BrandMark />
          <div>
            <p className="brand-name">Wild Bean</p>
            <p className="brand-subtitle">Manager</p>
          </div>
        </div>
        <Link
          href="/purchases/capture"
          className="icon-button icon-button-accent"
          aria-label="Capture receipt"
        >
          <ScanLine size={20} aria-hidden="true" />
        </Link>
      </header>

      {menuOpen ? (
        <div
          id="mobile-navigation"
          className="mobile-navigation"
          role="dialog"
          aria-label="Navigation"
        >
          <nav>
            <LocationSwitcher
              locations={locations}
              activeLocationId={activeLocationId}
              canCreate={hasCapability(role, "users:manage")}
            />
            {navigationLinks}
          </nav>
        </div>
      ) : null}

      <main className="manager-content">{children}</main>

      {hasCapability(role, "purchase:capture") ? (
        <Link href="/purchases/capture" className="capture-fab">
          <ScanLine size={20} aria-hidden="true" />
          <span>Capture receipt</span>
        </Link>
      ) : null}
    </div>
  );
}
