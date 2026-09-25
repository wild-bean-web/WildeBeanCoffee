import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getManagerSession } from "@/lib/auth/session";
import { getOrganizationBrand } from "@/services/brand/organization";

export const dynamic = "force-dynamic";

export default async function ManagerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getManagerSession();

  if (!session) {
    redirect("/login");
  }

  const brand = await getOrganizationBrand(session.organizationId);

  return (
    <AppShell
      displayName={session.displayName}
      role={session.role}
      isDemo={session.isDemo}
      locations={session.locations}
      activeLocationId={session.activeLocationId}
      organizationName={brand.displayName}
      primaryColor={brand.primaryColor}
      accentColor={brand.accentColor}
      hasLogo={brand.hasLogo}
    >
      {children}
    </AppShell>
  );
}
