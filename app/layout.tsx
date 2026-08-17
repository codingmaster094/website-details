import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Website Intelligence Analyzer",
  description: "Analyze a company website and extract structured business intelligence.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
