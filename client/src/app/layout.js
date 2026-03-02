import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import CookieNotice from "@/components/CookieNotice";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata = {
  title: "Wild Bean Coffee - Premium Coffee & Handcrafted Beverages",
  description:
    "Wild Bean Coffee offers premium coffee, handcrafted beverages, and delicious treats. Order online for pickup or visit us in store.",
  icons: {
    icon: [
      {
        url: "/images/logo/favicon/favicon1.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/images/logo/favicon/favicon1.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/images/logo/favicon/favicon1.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col antialiased overflow-x-hidden`}
      >
        <Nav />
        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
        <Footer />
        <CookieNotice />
      </body>
    </html>
  );
}
