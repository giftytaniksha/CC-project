import type { Metadata } from "next";
import "./globals.css";
import {StudioTheme} from '@/components/nutrition/studio-theme';
import {BloomIntro} from '@/components/nutrition/bloom-intro';

export const metadata: Metadata = {
  title: "The Daily Bloom — Nourish. Grow. Glow.",
  description: "The Daily Bloom — AI-Assisted Personalized Nutrition and Diet Recommendation System (Product 46). Personalized nutrition, thoughtful meal planning and everyday wellness.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased"><StudioTheme><BloomIntro/>{children}</StudioTheme></body>
    </html>
  );
}
