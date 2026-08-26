import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.SITE_TITLE || "Photography",
  description: "Photography portfolio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
