// app/layout.js
import "./globals.css";
import ClientLayout from './components/ClientLayout';

export const metadata = {
  title: "Sistema de Check-ins",
  description: "Controle de clientes para cabeleireiros",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
