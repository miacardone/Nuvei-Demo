import { cookies } from "next/headers";
import { BrandMark } from "@/components/brand-mark";
import { getBrand } from "@/lib/brand";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const brand = getBrand((await cookies()).get("brand")?.value);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — the first thing a demo audience sees, fully themed. */}
      <div className="hidden flex-col justify-between bg-primary p-12 text-ink-on-dark lg:flex">
        <BrandMark className="h-8" />
        <div>
          <p className="font-display text-4xl font-semibold leading-tight tracking-tight">
            {brand.tagline}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-on-dark/70">
            {brand.productName} — route, optimise and reconcile every
            transaction from one console.
          </p>
        </div>
        <p className="text-xs text-ink-on-dark/50">
          Demo environment · sandbox data
        </p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-16">
        <div className="mx-auto w-full max-w-sm">
          <span className="text-primary lg:hidden">
            <BrandMark className="h-7" />
          </span>

          <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight lg:mt-0">
            Sign in
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Access the {brand.productName} console.
          </p>

          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
