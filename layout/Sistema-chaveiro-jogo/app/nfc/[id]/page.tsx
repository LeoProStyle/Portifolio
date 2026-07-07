"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function NfcPage({ params }: { params: { id: string } }) {
  const [status, setStatus] = useState('Validating cartridge...');
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    const validate = async () => {
      try {
        const response = await fetch('/api/nfc/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nfcId: params.id })
        });

        const data = await response.json();

        if (!response.ok) {
          setStatus(data.error || 'Unable to validate cartridge.');
          return;
        }

        setStatus(`Validated ${data.game.title}`);
        setRedirectTo(data.redirectTo);
      } catch (error) {
        setStatus('Validation failed.');
      }
    };

    validate();
  }, [params.id]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">NFC validation</p>
        <h1 className="mt-4 text-3xl font-semibold">Carttridge detected: {params.id}</h1>
        <p className="mt-4 text-zinc-300">{status}</p>
        <div className="mt-8">
          {redirectTo ? (
            <Link href={redirectTo} className="rounded-full bg-cyan-500 px-5 py-3 font-medium text-zinc-950 transition hover:bg-cyan-400">
              Continue to game
            </Link>
          ) : (
            <span className="text-zinc-500">Waiting for validation response...</span>
          )}
        </div>
      </div>
    </main>
  );
}
