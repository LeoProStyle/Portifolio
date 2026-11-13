"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Balão com o texto completo de um nome cortado.
 * - Marque o texto que pode cortar com `data-clamp` (ex.: `truncate` ou `line-clamp-2`).
 * - Só aparece se o texto estiver realmente cortado.
 * - Abre com o mouse ou com foco pelo teclado (Tab); fecha ao sair, ao perder o foco ou com Esc
 *   (WCAG 1.4.13: dá para passar o mouse sobre o balão e dispensá-lo).
 * - Fica oculto para leitores de tela: o nome completo já está no rótulo acessível / no texto.
 */
export function NameTooltip({
  text,
  children,
  className = "",
}: {
  text: string;
  children: React.ReactNode;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const show = () => {
    const el = wrap.current?.querySelector<HTMLElement>("[data-clamp]");
    if (el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) setOpen(true);
  };
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      ref={wrap}
      className={`relative ${className}`}
      onPointerEnter={(e) => e.pointerType === "mouse" && show()}
      onPointerLeave={hide}
      onFocus={(e) => {
        let keyboard = true;
        try {
          keyboard = e.target.matches(":focus-visible");
        } catch {}
        if (keyboard) show();
      }}
      onBlur={hide}
    >
      {children}
      {open && (
        // pb-2 transparente = "ponte" para o mouse chegar ao balão sem fechá-lo
        <span aria-hidden className="absolute bottom-full left-0 z-20 pb-2">
          <span className="animate-tooltip relative block w-max max-w-[min(18rem,calc(100vw-2rem))] whitespace-normal break-words rounded-lg bg-ink px-2.5 py-1.5 text-left text-sm font-semibold leading-snug text-bg shadow-lg">
            {text}
            <span className="absolute -bottom-1 left-5 h-2 w-2 rotate-45 bg-ink" />
          </span>
        </span>
      )}
    </div>
  );
}
