"use client";

import React from "react";

const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const toNumber = (v: string) => {
  if (!v) return 0;
  const cleaned = v.replace(/[^0-9.,-]/g, "").trim();
  if (!cleaned) return 0;
  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

export default function CurrencyInput({
  value,
  onChange,
  id,
  className,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  id?: string;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = React.useState(() => formatBRL(value ?? 0));
  const editingRef = React.useRef(false);

  React.useEffect(() => {
    // sync when external value changes, but do not overwrite while user is editing
    if (editingRef.current) return;
    setText(formatBRL(value ?? 0));
  }, [value]);

  return (
    <input
      id={id}
      inputMode="decimal"
      type="text"
      value={text}
      placeholder={placeholder}
      className={className}
      onFocus={(e) => {
        editingRef.current = true;
        // show a plain numeric representation using comma as decimal separator
        const v = value ?? 0;
        const display = String(v).includes('.') ? String(v).replace('.', ',') : String(v === 0 ? '' : v);
        setText(display);
      }}
      onBlur={() => {
        editingRef.current = false;
        setText(formatBRL(value ?? 0));
      }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = toNumber(t);
        onChange(n);
      }}
    />
  );
}
