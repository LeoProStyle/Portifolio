import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/ui/theme-provider';
import { AuthProvider } from '@/context/AuthContext';
import { RestaurantProvider } from '@/context/RestaurantContext';
import MainLayout from '@/components/layout/MainLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Sistema de Lanchonete',
  description: 'Sistema de gerenciamento para lanchonetes e restaurantes',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <RestaurantProvider>
              <MainLayout>{children}</MainLayout>
            </RestaurantProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}