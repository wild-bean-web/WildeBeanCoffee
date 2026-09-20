import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getManagerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ManagerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getManagerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <AppShell
      displayName={session.displayName}
      role={session.role}
      isDemo={session.isDemo}
      locations={session.locations}
      activeLocationId={session.activeLocationId}
    >
      {children}
    </AppShell>
  );
}
