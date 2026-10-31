import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Workline | Human-reviewed business workflows",
    template: "%s | Workline",
  },
  description:
    "Validate operational requests, route exceptions, and keep human approval with the case.",
  applicationName: "Workline",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    title: "Workline | Human-reviewed business workflows",
    description:
      "Validate operational requests, route exceptions, and keep human approval with the case.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
