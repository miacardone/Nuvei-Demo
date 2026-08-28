"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/nav";
import { useBrand } from "@/components/brand-provider";
import { BrandMark } from "@/components/brand-mark";
import { Icon } from "./icon";

/**
 * Rendered twice: as the permanent rail at `lg` and up, and inside the mobile
 * drawer below it. `onNavigate` lets the drawer close itself on selection.
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { brand } = useBrand();

  return (
    <>
      <div className="flex h-16 items-center gap-3 px-6">
        <BrandMark className="h-6" />
      </div>

      <p className="px-6 pb-6 text-xs leading-relaxed text-ink-on-dark/60">
        {brand.productName}
      </p>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Main">
        {navItems.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-[var(--brand-radius)] px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-white/12 font-medium text-ink-on-dark"
                  : "text-ink-on-dark/70 hover:bg-white/8 hover:text-ink-on-dark"
              }`}
            >
              <Icon name={item.icon} className="size-[18px] shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-6 py-4 text-xs text-ink-on-dark/50">
        Demo environment · sandbox data
      </div>
    </>
  );
}

/** Permanent navigation rail, desktop only. */
export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-primary text-ink-on-dark lg:flex">
      <SidebarContent />
    </aside>
  );
}

/** Slide-over navigation for viewports below `lg`, where the rail is hidden. */
export function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Close navigation"
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-primary text-ink-on-dark shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={onClose}
          aria-label="Close navigation"
          className="absolute right-3 top-4 rounded-full p-2 text-ink-on-dark/70 hover:bg-white/10 hover:text-ink-on-dark"
        >
          <Icon name="close" className="size-5" />
        </button>
        <SidebarContent onNavigate={onClose} />
      </div>
    </div>
  );
}
