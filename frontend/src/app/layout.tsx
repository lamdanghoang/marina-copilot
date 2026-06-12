import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { WalletSync } from "@/components/WalletSync";

export const metadata: Metadata = {
  title: "Marina Copilot",
  description: "AI-powered DeFi assistant on Sui blockchain",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <WalletSync />
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
