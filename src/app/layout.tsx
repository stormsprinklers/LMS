import type { Metadata } from "next";
import { Montserrat, Source_Sans_3 } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "Storm Sprinklers LMS",
    template: "%s | Storm Sprinklers LMS",
  },
  description:
    "Employee learning platform for courses, video training, manuals, exams, and certifications.",
  icons: {
    icon: "/brand/storm-sprinklers-logo-transparent.png",
    apple: "/brand/storm-sprinklers-logo-transparent.png",
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
      <body className="min-h-full">{children}</body>
    </html>
  );
}
