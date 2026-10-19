import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

/**
 * PHASE 1 fonts — Figma UI3 typography (PROJECT_ANALYSIS.md §2):
 *   - Inter (variable) as the UI font. Figma uses non-standard weights
 *     450/550 (regular/medium); the variable axis makes those available
 *     via CSS font-weight without extra font files.
 *   - Roboto Mono (variable) for numeric/code contexts.
 * Both loaded through next/font (zero new packages, self-hosted).
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Figma - Design Editor",
  description: "Figma-like design editor built with Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${robotoMono.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: "var(--fig-font-family)" }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
