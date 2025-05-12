// app/layout.js
import "./globals.css";
import ClientLayout from './components/ClientLayout';

export const metadata = {
  title: "Salão do Rafinha",
  description: "Cartão Digital Salão do Rafinha",
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
