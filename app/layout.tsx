import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NetworkStatus from "./components/NetworkStatus"; 

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Konfigurasi Metadata Global
export const metadata: Metadata = {
  title: {
    template: "%s | SOCIAL HUB",
    default: "SOCIAL HUB",
  },
  description: "Social Productivity Hub by Hansen Pratama",
  icons: {
    // Karena logo.svg ada di /public, Next.js bisa langsung mengaksesnya via "/"
    icon: "/logo.svg",
    apple: "/logo.svg",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f8fafc] text-slate-900">
        {/* Komponen status jaringan dengan fitur auto-logout */}
        <NetworkStatus />

        <main className="flex-1 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}