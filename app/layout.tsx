import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HelioShield AI | Mission Safety Copilot",
  description:
    "Explainable AI that turns live space-weather signals into safer, evidence-backed launch decisions.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
