"use client";

import { useEffect, useState } from "react";

export default function FiscalConfigPage() {
  const [items, setItems] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const res = await fetch('/api/fiscal-config');
    const json = await res.json();
    if (json?.ok) setItems(json.data || []);
  };

  useEffect(() => { load(); }, []);

  const upload = async () => {
    if (!file) return alert('Selecione um arquivo');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/fiscal-config', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Erro');
      setFile(null);
      await load();
      alert('Enviado');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro inesperado');
    } finally { setLoading(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover este config?')) return;
    const res = await fetch('/api/fiscal-config', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
    const json = await res.json();
    if (!res.ok || !json?.ok) return alert(json?.error || 'Erro');
    await load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Fiscal Config (PFX upload)</h1>
      <div className="rounded-xl border bg-white p-4">
        <input type="file" accept=".pfx,.p12" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div className="mt-3">
          <button onClick={upload} disabled={loading} className="rounded bg-zinc-900 text-white px-3 py-2">Enviar</button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-medium">Configs</h2>
        <div className="mt-3 space-y-2">
          {items.map((it) => (
            <div key={it._id} className="flex items-center justify-between border-b py-2">
              <div>
                <div className="font-medium">{it.originalName}</div>
                <div className="text-sm text-zinc-500">{it.createdAt}</div>
              </div>
              <div className="flex gap-2">
                <a href={`/uploads/${it.filename}`} target="_blank" rel="noreferrer" className="text-blue-600">Download</a>
                <button onClick={() => remove(it._id)} className="text-red-600">Remover</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
