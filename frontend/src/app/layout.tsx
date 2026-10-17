import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "VoltaChain — Second life for every battery",
  description: "Verified second-hand battery marketplace with tamper-proof health reports on blockchain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Orbitron:wght@500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <WalletProvider>
          <Navbar />
          <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-10">{children}</main>
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
