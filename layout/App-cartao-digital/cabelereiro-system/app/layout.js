// app/layout.js
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import UserNav from "@/app/components/UserNav";

export const metadata = {
  title: "Sistema de Check-ins",
  description: "Controle de clientes para cabeleireiros",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="pt-BR">
        <body className="min-h-screen bg-gray-50">
          <nav className="bg-gray-800 p-4 text-white flex justify-between items-center">
            <h1 className="font-bold text-xl">Sistema de Check-ins</h1>
            <UserNav />
          </nav>
          <main className="container mx-auto p-10">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
