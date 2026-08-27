import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter_Tight } from "next/font/google";
import { BrandProvider } from "@/components/brand-provider";
import { brandToCssVars, getBrand } from "@/lib/brand";
import "./globals.css";

/** Nuvei's 2026 brand face. Shared by both skins in this demo. */
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = getBrand((await cookies()).get("brand")?.value);
  return {
    title: `${brand.productName} — ${brand.name}`,
    description: brand.tagline,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const brand = getBrand((await cookies()).get("brand")?.value);

  return (
    <html
      lang="en"
      className={`${interTight.variable} h-full antialiased`}
      style={brandToCssVars(brand) as React.CSSProperties}
    >
      <body className="min-h-full">
        <BrandProvider brand={brand}>{children}</BrandProvider>
      </body>
    </html>
  );
}
