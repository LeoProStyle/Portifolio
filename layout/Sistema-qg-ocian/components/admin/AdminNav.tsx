"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Package, Wallet, CreditCard } from "lucide-react";

const LINKS = [
  { href: "/admin", label: "Produtos", icon: Package, exact: true },
  { href: "/admin/fechamentos", label: "Fechamentos", icon: CreditCard },
  { href: "/admin/despesas", label: "Despesas", icon: Wallet },
  { href: "/admin/cupons", label: "Cupons", icon: FileText },
];

/** Abas internas do Admin: produtos + financeiro. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <div className="inline-flex min-w-full gap-1 rounded-2xl border border-line bg-surface p-1 sm:min-w-0">
        {LINKS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors sm:px-3 sm:text-sm ${
                active ? "bg-brand text-brand-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <Icon size={16} aria-hidden className="hidden sm:block" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
