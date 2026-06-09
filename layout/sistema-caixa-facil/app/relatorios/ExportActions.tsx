"use client";

import { useState } from "react";

import type { CashClosure, Expense, PaymentMethod } from "@/types";

type ExportKind = "PDF" | "Excel" | "XML";

const paymentLabel: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mockClosuresForMonth(): CashClosure[] {
  // Baseado nos mock atuais de /fechamentos (e expandido para dar dinâmica ao comparativo)
  return [
    {
      id: "cl-2026-06-01",
      date: "2026-06-01",
      dinheiro: 80,
      pix: 220,
      cartao_credito: 150,
      cartao_debito: 60,
      total: 510,
      observacao: "",
    },
    {
      id: "cl-2026-06-08",
      date: "2026-06-08",
      dinheiro: 150,
      pix: 850,
      cartao_credito: 500,
      cartao_debito: 200,
      total: 1700,
    },
    {
      id: "cl-2026-06-15",
      date: "2026-06-15",
      dinheiro: 60,
      pix: 300,
      cartao_credito: 220,
      cartao_debito: 90,
      total: 670,
    },
  ];
}

function mockExpensesForMonth(): Expense[] {
  // Baseado nos mocks atuais de /despesas (expandido)
  return [
    {
      id: "ex-2026-06-01",
      date: "2026-06-01",
      category: "Internet",
      description: "Plano mensal",
      amount: 120,
    },
    {
      id: "ex-2026-06-15",
      date: "2026-06-15",
      category: "Funcionários",
      description: "Ajuda custo",
      amount: 200,
    },
  ];
}

export default function ExportActions() {
  const [loading, setLoading] = useState<ExportKind | null>(null);

  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));

  const [monthData, setMonthData] = useState(() => {
    // fallback mock até carregar via API
    const closures = mockClosuresForMonth();
    const expenses = mockExpensesForMonth();

    const totalsByPayment: Record<PaymentMethod, number> = {
      dinheiro: 0,
      pix: 0,
      cartao_credito: 0,
      cartao_debito: 0,
    };

    for (const c of closures) {
      totalsByPayment.dinheiro += c.dinheiro;
      totalsByPayment.pix += c.pix;
      totalsByPayment.cartao_credito += c.cartao_credito;
      totalsByPayment.cartao_debito += c.cartao_debito;
    }

    const totalEntrada = closures.reduce((s, c) => s + c.total, 0);
    const totalDespesas = expenses.reduce((s, e) => s + e.amount, 0);
    const lucroEstimado = totalEntrada - totalDespesas;

    const daily = closures
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((c) => ({
        dateBR: c.date.split("-").reverse().join("/"),
        total: c.total,
      }));

    return {
      closures,
      expenses,
      totalsByPayment,
      totalEntrada,
      totalDespesas,
      lucroEstimado,
      daily,
    };
  });

  const fetchMonthlyPayload = async () => {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ month, year, kind: "PDF" }),
    });

    const json = await res.json();
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao carregar dados do mês");

    const p = json.payload;
    setMonthData({
      closures: p.closures,
      expenses: p.expenses,
      totalsByPayment: p.totalsByPayment,
      totalEntrada: p.totalEntrada,
      totalDespesas: p.totalDespesas,
      lucroEstimado: p.lucroEstimado,
      daily: (p.daily || []).map((d: { date: string; total: number }) => ({
        dateBR: d.date.split("-").reverse().join("/"),
        total: d.total,
      })),
    });
  };







  const exportPayloadPreview = (kind: ExportKind) => {
    const lines: string[] = [];
    lines.push(`Caixa Fácil - Exportação (${kind})`);
    lines.push(`Entradas do mês: ${formatBRL(monthData.totalEntrada)}`);
    lines.push(`Despesas do mês: ${formatBRL(monthData.totalDespesas)}`);
    lines.push(`Lucro estimado: ${formatBRL(monthData.lucroEstimado)}`);
    lines.push("");
    lines.push("Formas de pagamento:");
    (Object.keys(paymentLabel) as PaymentMethod[]).forEach((m) => {
      lines.push(`- ${paymentLabel[m]}: ${formatBRL(monthData.totalsByPayment[m])}`);
    });
    lines.push("");
    lines.push("Comparativo por dia:");
    for (const d of monthData.daily) {
      lines.push(`- ${d.dateBR}: ${formatBRL(d.total)}`);
    }
    return lines.join("\n");
  };

  const onExport = async (kind: ExportKind) => {
    setLoading(kind);
    try {
      // Para o MVP XML: chama o backend que monta o payload e retorna um XML consolidado.
      if (kind === "XML") {
        const res = await fetch("/api/export", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ month, year, kind: "XML" }),
        });

        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Falha ao gerar XML");

        if (!json?.xml) {
          alert(exportPayloadPreview(kind));
          return;
        }

        const blob = new Blob([json.xml], { type: "application/xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `caixa-facil-${year}-${month}.xml`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }

      // Outros formatos: segue preview consolidado no MVP.
      alert(exportPayloadPreview(kind));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!!loading}
          onClick={() => onExport("PDF")}
          className="flex-1 rounded-xl bg-zinc-900 text-white px-3 py-2 text-sm font-medium disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {loading === "PDF" ? "Gerando..." : "PDF"}
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={() => onExport("Excel")}
          className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading === "Excel" ? "Gerando..." : "Excel"}
        </button>
      </div>

      <button
        type="button"
        disabled={!!loading}
        onClick={() => onExport("XML")}
        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm font-medium disabled:opacity-60"
      >
        {loading === "XML" ? "Gerando..." : "XML"}
      </button>
    </div>
  );
}


