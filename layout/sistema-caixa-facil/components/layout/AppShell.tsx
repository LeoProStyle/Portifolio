"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReceiptText, Wallet, ListChecks, SquarePen, BarChart3 } from "lucide-react";
import UserMenu from "./UserMenu";

function NavItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={
        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition " +
        (active
          ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800")
      }
    >
      <span className={active ? "text-white dark:text-black" : "text-zinc-500 dark:text-zinc-400"}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="sticky top-0 z-10 bg-zinc-50/80 dark:bg-black/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-900">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black flex items-center justify-center font-bold">
              CF
            </div>
            <div>
              <div className="text-sm font-semibold leading-4">Caixa Fácil</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-300">MVP</div>
            </div>
          </div>

          <UserMenu />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block border-r border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950">
          <div className="p-4 space-y-1">
            <NavItem href="/dashboard" label="Dashboard" icon={<SquarePen className="h-4 w-4" />} />
            <NavItem href="/fechamentos" label="Fechamentos" icon={<ListChecks className="h-4 w-4" />} />
            <NavItem href="/despesas" label="Despesas" icon={<Wallet className="h-4 w-4" />} />
            <NavItem href="/notas-de-compras" label="Notas de compras" icon={<ReceiptText className="h-4 w-4" />} />
            <NavItem href="/emissao-de-nota" label="Emissão de nota" icon={<ReceiptText className="h-4 w-4" />} />
            <NavItem href="/relatorios" label="Relatórios" icon={<BarChart3 className="h-4 w-4" />} />
          </div>
        </aside>

        <main className="p-4 lg:p-6">{children}</main>
      </div>

      {/* Mobile bottom nav (simple) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-50/95 dark:bg-black/95 backdrop-blur border-t border-zinc-200 dark:border-zinc-900 lg:hidden">
        <div className="grid grid-cols-5 text-center">
          <NavItem href="/dashboard" label="" icon={<SquarePen className="mx-auto h-4 w-4" />} />
          <NavItem href="/fechamentos" label="" icon={<ListChecks className="mx-auto h-4 w-4" />} />
          <NavItem href="/despesas" label="" icon={<Wallet className="mx-auto h-4 w-4" />} />
          <NavItem href="/notas-de-compras" label="" icon={<ReceiptText className="mx-auto h-4 w-4" />} />
          <NavItem href="/emissao-de-nota" label="" icon={<ReceiptText className="mx-auto h-4 w-4" />} />
          <NavItem href="/relatorios" label="" icon={<BarChart3 className="mx-auto h-4 w-4" />} />
        </div>
      </nav>
    </div>
  );
}

