"use client";

import { useBrand } from "./brand-provider";

/**
 * Renders the active brand's wordmark. The SVG uses `currentColor` throughout,
 * so the mark inherits whatever text colour its container sets. The child
 * selector sizes the inlined <svg> to the wrapper, which it cannot do itself.
 */
export function BrandMark({ className = "h-7" }: { className?: string }) {
  const { brand } = useBrand();
  return (
    <span
      className={`inline-block [&>svg]:h-full [&>svg]:w-auto ${className}`}
      // Brand marks are trusted, first-party assets from src/lib/brand.ts.
      dangerouslySetInnerHTML={{ __html: brand.logo }}
    />
  );
}
