"use client";

import { brands } from "@/lib/brand";
import { useBrand } from "@/components/brand-provider";

/**
 * The white-label proof point: same components, same data, different brand.
 */
export function BrandSwitcher() {
  const { brand, setBrandId, isSwitching } = useBrand();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-ink-muted">Brand</span>
      <select
        value={brand.id}
        disabled={isSwitching}
        onChange={(e) => setBrandId(e.target.value)}
        className="rounded-[var(--brand-radius)] border border-line-strong bg-surface-raised px-3 py-1.5 text-sm text-ink"
      >
        {Object.values(brands).map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
