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
  title: {
    default: "CloudUS",
    template: "%s | CloudUS",
  },
  description: "CloudUS Online Examination System",
  applicationName: "CloudUS",
  robots: { index: false, follow: false },
  openGraph: {
    title: "CloudUS",
    description: "CloudUS Online Examination System",
    images: ["/cloudus-logo.png"],
  },
  twitter: {
    card: "summary",
    title: "CloudUS",
    description: "CloudUS Online Examination System",
    images: ["/cloudus-logo.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Typed explicitly rather than via the generated `LayoutProps<"/">`: that
// helper resolves against every layout route, and adding the admin layout made
// it ambiguous. The shape is the same.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
