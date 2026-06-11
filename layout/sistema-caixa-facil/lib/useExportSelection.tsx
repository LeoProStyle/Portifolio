"use client";

import { useEffect, useState } from "react";

type ExportType = "fechamentos" | "despesas" | "notas";

export function useExportSelection(type: ExportType) {
  const key = `export:selected:${type}`;
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          setSelected(e.newValue ? (JSON.parse(e.newValue) as string[]) : []);
        } catch {
          setSelected([]);
        }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [key]);

  const persist = (next: string[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };

  const toggle = (id: string, checked?: boolean) => {
    setSelected((prev) => {
      const has = prev.includes(id);
      let next: string[];
      if (checked === undefined) {
        next = has ? prev.filter((x) => x !== id) : [...prev, id];
      } else if (checked) {
        next = has ? prev : [...prev, id];
      } else {
        next = has ? prev.filter((x) => x !== id) : prev;
      }
      persist(next);
      return next;
    });
  };

  const clear = () => {
    try {
      localStorage.removeItem(key);
    } catch {}
    setSelected([]);
  };

  return { selected, toggle, clear, setSelected } as const;
}
