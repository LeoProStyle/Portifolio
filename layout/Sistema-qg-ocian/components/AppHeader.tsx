"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutDashboard, Receipt, Settings2 } from "lucide-react";

const TABS = [
  { href: "/saida", label: "Saída", icon: ClipboardList },
  { href: "/vendas", label: "Vendas", icon: Receipt, soon: true },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin", label: "Admin", icon: Settings2 },
];

export function AppHeader() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/saida" className="flex shrink-0 items-center gap-2 font-extrabold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg text-brand-ink" aria-hidden>
            ☕
          </span>
          <span className="hidden sm:inline">QG Ocian</span>
        </Link>
        <nav
          aria-label="Principal"
          className="flex flex-1 justify-between gap-0.5 overflow-x-auto [scrollbar-width:none] sm:justify-end sm:gap-1"
        >
          {TABS.map(({ href, label, icon: Icon, soon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors sm:px-3 sm:text-sm ${
                  active ? "bg-ink text-bg" : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon size={16} aria-hidden className="hidden min-[380px]:block" />
                {label}
                {soon && (
                  <>
                    <span className="hidden rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand sm:inline">
                      breve
                    </span>
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand sm:hidden" aria-label="em breve" />
                  </>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
