"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";
import { useBrand } from "@/components/brand-provider";
import { BrandMark } from "@/components/brand-mark";
import { Icon } from "./icon";

export function Sidebar() {
  const pathname = usePathname();
  const { brand } = useBrand();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-primary text-ink-on-dark lg:flex">
      <div className="flex h-16 items-center gap-3 px-6">
        <BrandMark className="h-6 w-auto" />
      </div>

      <p className="px-6 pb-6 text-xs leading-relaxed text-ink-on-dark/60">
        {brand.productName}
      </p>

      <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-[var(--brand-radius)] px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-white/12 font-medium text-ink-on-dark"
                  : "text-ink-on-dark/70 hover:bg-white/8 hover:text-ink-on-dark"
              }`}
            >
              <Icon name={item.icon} className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-6 py-4 text-xs text-ink-on-dark/50">
        Demo environment · sandbox data
      </div>
    </aside>
  );
}
