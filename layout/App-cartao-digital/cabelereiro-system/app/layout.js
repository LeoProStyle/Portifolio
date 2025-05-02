// app/layout.js
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import UserNav from "@/app/components/UserNav"; // ajuste o caminho se necessário

export const metadata = {
  title: "Sistema de Check-ins",
  description: "Controle de clientes para cabeleireiros",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      <html lang="pt-BR">
        <body>
          <nav className="bg-gray-800 p-4 text-white flex justify-between">
            <h1 className="font-bold">Sistema de Check-ins</h1>
            <UserNav />
          </nav>
          <main className="container mx-auto p-10">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
