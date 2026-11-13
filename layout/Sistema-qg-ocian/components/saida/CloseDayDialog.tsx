"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/Modal";
import { post } from "@/lib/client";
import { formatLongDate } from "@/lib/date";
import type { RegisterDTO } from "@/lib/types";
import { SummaryList, Totals } from "./SaidaBoard";

type Props = {
  open: boolean;
  register: RegisterDTO;
  onClose: () => void;
  onClosed: (r: RegisterDTO) => void;
};

export function CloseDayDialog({ open, register, onClose, onClosed }: Props) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await post<{ register: RegisterDTO }>("/api/saida/close", { date: register.date, notes });
      setNotes("");
      onClosed(res.register);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao fechar o dia.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Fechar o dia"
      onClose={saving ? () => undefined : onClose}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-2xl border border-line py-3 font-semibold hover:bg-surface-2"
          >
            Voltar
          </button>
          <button
            onClick={confirm}
            disabled={saving}
            className="flex-[2] rounded-2xl bg-brand py-3 font-bold text-brand-ink disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Confirmar fechamento"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Confira a relação de <strong className="text-ink">{formatLongDate(register.date)}</strong>. Depois
          de fechado, o dia não aceita mais alterações.
        </p>

        {register.items.length === 0 && (
          <div className="flex gap-2 rounded-xl bg-brand-soft p-3 text-sm text-brand">
            <AlertTriangle size={18} className="shrink-0" aria-hidden />
            Nada foi anotado neste dia. Quer fechar mesmo assim?
          </div>
        )}

        <SummaryList items={register.items} />
        <Totals totalItems={register.totalItems} totalCents={register.totalCents} />

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Observação (opcional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Ex.: acabou o pão às 16h, movimento fraco por causa da chuva…"
            className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
