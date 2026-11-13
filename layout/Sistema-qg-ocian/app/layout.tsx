import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "QG Ocian — Controle",
  description: "Controle diário de saída de produtos da lanchonete QG Ocian",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#12100e" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${jakarta.variable} font-sans antialiased min-h-dvh`}>
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
