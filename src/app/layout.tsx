import type { Metadata, Viewport } from "next";
import { Montserrat, Source_Sans_3 } from "next/font/google";
import { PwaProvider } from "@/components/pwa/PwaProvider";
import "./globals.css";

const titleFont = Montserrat({
  variable: "--font-title",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const bodyFont = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const APP_NAME = "Storm Sprinklers LMS";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#102341",
};

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "Employee learning platform for courses, video training, manuals, exams, and certifications.",
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LMS",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icon.png",
    other: [
      {
        rel: "apple-touch-icon",
        url: "/apple-icon.png",
        sizes: "180x180",
      },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "LMS",
    "apple-mobile-web-app-status-bar-style": "default",
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
      className={`${titleFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full touch-manipulation">
        {children}
        <PwaProvider />
      </body>
    </html>
  );
}

