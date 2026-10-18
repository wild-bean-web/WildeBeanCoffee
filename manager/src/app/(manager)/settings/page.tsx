import {
  Database,
  Inbox,
  KeyRound,
  Shield,
  Store,
  UserRoundCog,
} from "lucide-react";
import { BrandSettingsForm } from "@/components/brand-settings-form";
import { InviteStaffForm } from "@/components/invite-staff-form";
import { LocationBillingList } from "@/components/location-billing";
import { PayrollCalendarForm } from "@/components/payroll-calendar-form";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import {
  LocationCloverForm,
  LocationIdentityForm,
  LocationMailboxForm,
} from "@/components/store-setup-forms";
import { hasCapability } from "@/lib/auth/capabilities";
import { requireManagerSession } from "@/lib/auth/session";
import { formatCafeAddress } from "@/lib/location";
import { getOrganizationBrand } from "@/services/brand/organization";
import { listLocationBilling } from "@/services/billing/locations";
import { getPayrollCalendar } from "@/services/payroll/calendar";
import { listCompanyPeople } from "@/services/staff/invite";
import { roleLabel } from "@/domain/companies";
import { getLocationSetup } from "@/services/locations/setup";

export default async function SettingsPage() {
  const session = await requireManagerSession();
  const setup = await getLocationSetup(session);
  const brandTheme = await getOrganizationBrand(session.organizationId);
  const payrollCalendar = await getPayrollCalendar(session.organizationId);
  const people = session.organizationId ? await listCompanyPeople(session.organizationId) : [];
  const billing = session.organizationId ? await listLocationBilling(session.organizationId) : [];
  const locationName = setup.location?.name ?? "this store";
  const canBrand = hasCapability(session.role, "users:manage");

  const brand = [
    {
      icon: UserRoundCog,
      name: "Access role",
      detail: session.role.replace("_", " "),
      status: session.isDemo ? "Preview" : "Active",
      tone: session.isDemo ? ("info" as const) : ("success" as const),
    },
    {
      icon: KeyRound,
      name: "Multi-factor authentication",
      detail: "Required before production access",
      status: session.isDemo ? "Not verified" : "Provider managed",
      tone: session.isDemo ? ("warning" as const) : ("success" as const),
    },
    {
      icon: Database,
      name: "Manager database",
      detail: "Dedicated PostgreSQL; never the storefront MongoDB",
      status: setup.brand.databaseConfigured ? "Configured" : "Needs setup",
      tone: setup.brand.databaseConfigured
        ? ("success" as const)
        : ("warning" as const),
    },
    {
      icon: Shield,
      name: "Financial documents",
      detail: "Private bucket with short-lived access links",
      status: setup.brand.documentsConfigured ? "Configured" : "Needs setup",
      tone: setup.brand.documentsConfigured
        ? ("success" as const)
        : ("warning" as const),
    },
    {
      icon: Store,
      name: "Clover platform webhook",
      detail: "Brand signing secret shared by every location connection",
      status: setup.brand.cloverWebhookConfigured
        ? "Configured"
        : "Needs setup",
      tone: setup.brand.cloverWebhookConfigured
        ? ("success" as const)
        : ("warning" as const),
    },
    {
      icon: Inbox,
      name: "Postmark inbound secret",
      detail: "Authenticates inbound email; each location has its own mailbox",
      status: setup.brand.postmarkConfigured ? "Configured" : "Optional",
      tone: setup.brand.postmarkConfigured
        ? ("success" as const)
        : ("info" as const),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Store setup"
        title={setup.location ? `Set up ${locationName}` : "Set up a store"}
        description="Each location keeps its own Clover merchant, invoice mailbox, documents, inventory, and sales. Brand catalog and staff identities stay shared."
      />

      {canBrand ? (
        <section className="panel mb-5">
          <div className="panel-header">
            <div>
              <h2>Company brand</h2>
              <p>
                Logo and colors belong to {brandTheme.displayName}. Every location in this company uses them.
              </p>
            </div>
          </div>
          <BrandSettingsForm
            primaryColor={brandTheme.primaryColor}
            accentColor={brandTheme.accentColor}
            hasLogo={brandTheme.hasLogo}
          />
        </section>
      ) : null}

      {canBrand ? (
        <section className="panel mb-5">
          <div className="panel-header">
            <div>
              <h2>Pay calendar</h2>
              <p>
                Current payroll and Previous payroll on the Labor page follow this company&apos;s first pay-period day.
              </p>
            </div>
          </div>
          <PayrollCalendarForm
            anchor={payrollCalendar.anchor}
            periodDays={payrollCalendar.periodDays}
            saved={payrollCalendar.saved}
          />
        </section>
      ) : null}

      {canBrand ? (
        <section className="panel mb-5">
          <div className="panel-header">
            <div>
              <h2>People</h2>
              <p>Invite a manager, purchaser, counter, or accountant. They get an email and sign in.</p>
            </div>
          </div>
          <InviteStaffForm />
          {people.length > 0 ? (
            <ul className="exception-list">
              {people.map((person) => (
                <li key={person.id}>
                  <div>
                    <strong>{person.displayName}</strong>
                    <span>
                      {person.email} · {roleLabel(person.role)} · {person.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {canBrand && billing.length > 0 ? (
        <section className="panel mb-5">
          <div className="panel-header">
            <div>
              <h2>Location billing</h2>
              <p>A new company&apos;s first location includes 14 days. After that, each location is a subscription.</p>
            </div>
          </div>
          <LocationBillingList locations={billing} />
        </section>
      ) : null}

      {setup.location ? (
        <>
          <section className="panel mb-5">
            <div className="panel-header">
              <div>
                <h2>1. Store identity</h2>
                <p>
                  {formatCafeAddress(setup.location.address) ??
                    `${setup.location.code} · ${setup.location.timezone}`}
                </p>
              </div>
              <StatusPill tone="success">Current</StatusPill>
            </div>
            <div className="panel-body">
              <LocationIdentityForm
                key={`${setup.location.id}-identity`}
                setup={setup}
              />
            </div>
          </section>

          <section className="panel mb-5">
            <div className="panel-header">
              <div>
                <h2>2. Clover for {locationName}</h2>
                <p>
                  Merchant ID and API token belong to this store. Include
                  Employees (read) so Labor can import the time clock.
                </p>
              </div>
              <StatusPill
                tone={setup.clover.configured ? "success" : "warning"}
              >
                {setup.clover.configured
                  ? setup.clover.tokenSource === "env"
                    ? "Env bootstrap"
                    : "Connected"
                  : "Needs merchant"}
              </StatusPill>
            </div>
            <div className="panel-body">
              <LocationCloverForm
                key={`${setup.location.id}-clover`}
                setup={setup}
              />
            </div>
          </section>

          <section className="panel mb-5">
            <div className="panel-header">
              <div>
                <h2>3. Invoice mailbox for {locationName}</h2>
                <p>
                  Forward Restaurant Store and other vendor invoices to this
                  store’s address. Uploads still work without email.
                </p>
              </div>
              <StatusPill
                tone={setup.mailbox.configured ? "success" : "warning"}
              >
                {setup.mailbox.configured ? "Connected" : "Optional"}
              </StatusPill>
            </div>
            <div className="panel-body">
              <LocationMailboxForm
                key={`${setup.location.id}-mailbox`}
                setup={setup}
              />
            </div>
          </section>
        </>
      ) : (
        <section className="panel mb-5">
          <div className="panel-header">
            <div>
              <h2>Choose a location</h2>
              <p>
                {setup.canManage
                  ? "Use Add location in the Location menu, then connect Clover and the invoice mailbox here."
                  : "An owner needs to add the first location."}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Brand environment</h2>
            <p>
              Database, document storage, and webhook secrets stay in .env.
              Store Clover tokens and mailboxes do not.
            </p>
          </div>
        </div>
        <ul className="list">
          {brand.map((setting) => {
            const Icon = setting.icon;
            return (
              <li className="list-row" key={setting.name}>
                <div className="list-leading">
                  <Icon size={18} />
                </div>
                <div className="list-copy">
                  <p className="list-title">{setting.name}</p>
                  <p className="list-meta">{setting.detail}</p>
                </div>
                <StatusPill tone={setting.tone}>{setting.status}</StatusPill>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
