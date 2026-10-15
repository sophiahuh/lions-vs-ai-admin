import type { Metadata } from "next";
import { Geist, Geist_Mono, Libre_Caslon_Text } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const caslon = Libre_Caslon_Text({ variable: "--font-caslon", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "Lions vs. AI · Admin",
  description: "Admin area for Lions vs. AI.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${caslon.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
