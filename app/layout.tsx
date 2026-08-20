import type { Metadata } from "next";
import { DM_Sans, Inter, Manrope, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "latin-ext"] });
const sourceSans = Source_Sans_3({ variable: "--font-source-sans", subsets: ["latin", "latin-ext"] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin", "latin-ext"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "APU Site 0.1",
  description: "APU — Asistent pedagogické podpory",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body className={`${manrope.variable} ${sourceSans.variable} ${dmSans.variable} ${inter.variable}`}>{children}</body>
    </html>
  );
}
