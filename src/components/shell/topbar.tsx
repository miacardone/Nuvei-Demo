"use client";

import { BrandMark } from "@/components/brand-mark";
import { logout } from "@/app/login/actions";
import { Icon } from "./icon";
import { BrandSwitcher } from "./brand-switcher";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="flex h-16 items-center gap-4 border-b border-line bg-surface-raised px-6">
      <span className="text-primary lg:hidden">
        <BrandMark className="h-5" />
      </span>

      <h1 className="font-display text-lg font-semibold tracking-tight">
        {title}
      </h1>

      <div className="ml-auto flex items-center gap-4">
        <BrandSwitcher />
        <button
          type="button"
          aria-label="Notifications"
          className="rounded-full p-2 text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          <Icon name="bell" />
        </button>
        <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-primary">
          MC
        </span>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-ink-muted transition-colors hover:text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
