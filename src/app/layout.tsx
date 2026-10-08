import type { Metadata, Viewport } from "next";
import { Encode_Sans } from "next/font/google";
import "./globals.css";

const encode = Encode_Sans({ subsets: ["latin", "latin-ext"], weight: "variable", variable: "--font-encode" });

export const metadata: Metadata = {
  title: { default: "dexena PV", template: "%s · dexena PV" },
  description: "PV-Monitoring für SolarMax-Wechselrichter",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#855ced",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={encode.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
