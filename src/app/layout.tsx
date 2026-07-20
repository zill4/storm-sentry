import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";
import { VisitBeacon } from "@/components/visit-beacon";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for page titles + section headings. Inter, weighted bold to
// echo the Storm Sentry wordmark (see DESIGN.md).
const inter = Inter({
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Storm Sentry — Advanced Severe Weather Prediction",
  description:
    "Storm Sentry resolves live severe-weather alerts to the ZIP code and routes them to the field — advanced severe weather prediction.",
  icons: {
    icon: [{ url: "/brand/mark.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/avatar.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#EEF3F9] text-[#0B2037]">
        <SiteNav />
        <VisitBeacon />
        {children}
      </body>
    </html>
  );
}
