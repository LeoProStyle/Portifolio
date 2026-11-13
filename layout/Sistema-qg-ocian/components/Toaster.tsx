"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type Toast = { id: number; message: string; kind: "success" | "error" };
const EVENT = "qg-toast";

/** Mostra um aviso rápido no rodapé. Pode ser chamado de qualquer componente cliente. */
export function toast(message: string, kind: Toast["kind"] = "success") {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    let seq = 0;
    const onToast = (e: Event) => {
      const { message, kind } = (e as CustomEvent<Omit<Toast, "id">>).detail;
      const id = ++seq;
      setItems((list) => [...list.slice(-2), { id, message, kind }]);
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), kind === "error" ? 5000 : 2800);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${
            t.kind === "error"
              ? "border-danger/30 bg-danger-soft text-danger"
              : "border-success/30 bg-success-soft text-success"
          }`}
        >
          {t.kind === "error" ? <XCircle size={18} aria-hidden /> : <CheckCircle2 size={18} aria-hidden />}
          {t.message}
        </div>
      ))}
    </div>
  );
}
