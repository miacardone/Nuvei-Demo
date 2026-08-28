"use client";

import { BrandMark } from "@/components/brand-mark";
import { logout } from "@/app/login/actions";
import { features } from "@/lib/features";
import { Icon } from "./icon";
import { BrandSwitcher } from "./brand-switcher";

export function Topbar({
  title,
  onMenuClick,
}: {
  title: string;
  onMenuClick: () => void;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface-raised px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation"
        className="-ml-1 rounded-[var(--brand-radius)] p-2 text-ink-muted hover:bg-surface-sunken hover:text-ink lg:hidden"
      >
        <Icon name="menu" />
      </button>

      <span className="shrink-0 text-primary lg:hidden">
        <BrandMark className="h-5" />
      </span>

      {/* The page title is the mark's job on the narrowest screens, where the
          brand already identifies the app and horizontal room is scarce. */}
      <h1 className="hidden truncate font-display text-lg font-semibold tracking-tight sm:block">
        {title}
      </h1>

      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        {features.brandSwitcher && (
          <span className="hidden sm:block">
            <BrandSwitcher />
          </span>
        )}
        <button
          type="button"
          aria-label="Notifications"
          className="rounded-full p-2 text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          <Icon name="bell" />
        </button>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-primary">
          MC
        </span>
        <form action={logout}>
          <button
            type="submit"
            aria-label="Sign out"
            className="rounded-[var(--brand-radius)] p-2 text-sm text-ink-muted transition-colors hover:text-ink sm:p-0"
          >
            <span className="hidden sm:inline">Sign out</span>
            <span className="sm:hidden">
              <Icon name="logout" className="size-5" />
            </span>
          </button>
        </form>
      </div>
    </header>
  );
}
