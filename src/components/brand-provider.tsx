"use client";

import { createContext, useContext, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type Brand, brands } from "@/lib/brand";

type BrandContextValue = {
  brand: Brand;
  setBrandId: (id: string) => void;
  isSwitching: boolean;
};

const BrandContext = createContext<BrandContextValue | null>(null);

/**
 * The active brand is resolved on the server from the `brand` cookie, so the
 * first paint is already themed and there is no hydration flash. Switching
 * writes the cookie and refreshes the server tree.
 */
export function BrandProvider({
  brand,
  children,
}: {
  brand: Brand;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isSwitching, startTransition] = useTransition();

  function setBrandId(id: string) {
    if (!brands[id]) return;
    document.cookie = `brand=${id}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <BrandContext.Provider value={{ brand, setBrandId, isSwitching }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand must be used inside <BrandProvider>");
  return ctx;
}
