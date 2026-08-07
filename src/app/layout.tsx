import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mine Crush",
  description:
    "Minesweeper meets Candy Crush — combos, power-ups, versus & co-op. Built for iPhone as a PWA.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mine Crush",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f0720" },
    { media: "(prefers-color-scheme: light)", color: "#1e0b3a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-[#0f0720] font-sans text-white">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_#4c1d95_0%,_transparent_55%),radial-gradient(ellipse_at_bottom,_#831843_0%,_#0f0720_60%)]" />
        {children}
      </body>
    </html>
  );
}
