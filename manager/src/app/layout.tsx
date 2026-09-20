import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Wild Bean Manager",
    template: "%s · Wild Bean Manager",
  },
  description:
    "Private operations, purchasing, inventory, COGS, and close workspace for Wild Bean Coffee.",
  applicationName: "Wild Bean Manager",
  icons: {
    icon: "/brand/wild-bean-logo.jpg",
    apple: "/brand/wild-bean-logo.jpg",
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#24160e",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
