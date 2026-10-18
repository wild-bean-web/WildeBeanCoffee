import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { StartCompanyForm } from "@/components/start-company-form";

export default function StartCompanyPage() {
  return (
    <main className="auth-shell">
      <section className="auth-brand" aria-label="Manager">
        <div className="auth-brand-content">
          <BrandMark large />
          <h1>Open a book for your store.</h1>
          <p>
            Sales, labor, and where the money went, kept separate for each location.
            The first location starts a 14-day trial.
          </p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>Start a company</h2>
          <p>You become the owner. Invite a manager after you sign in.</p>
          <StartCompanyForm />
          <p className="mt-3 text-sm text-muted">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
