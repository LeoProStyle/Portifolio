"use client";

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

// Computer side of the pairing: the code shown on the phone (/nfc/[id]) becomes a play pass here.
export default function ConnectPage() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) {
      setError('The code has 6 digits.');
      return;
    }

    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/pair/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: digits })
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 429) {
          const minutes = Math.ceil((Number(data.retryAfterSeconds) || 60) / 60);
          setError(`Too many attempts. Try again in ${minutes} min.`);
        } else if (response.status === 404) {
          setError('Invalid or expired code. Ask the phone for a new one.');
        } else {
          setError(data.error || 'Could not check the code.');
        }
        setSending(false);
        return;
      }
      // Full page load, so /play starts with the new pass cookie.
      window.location.assign(data.redirectTo);
    } catch {
      setError('Could not check the code.');
      setSending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Play on this computer</p>
        <h1 className="mt-4 text-3xl font-semibold">Connect your cartridge</h1>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-zinc-300">
          <li>Tap your RetroKey cartridge on your phone.</li>
          <li>On the phone, choose &quot;Play on a computer&quot;.</li>
          <li>Type the 6-digit code below.</li>
        </ol>

        <form onSubmit={onSubmit} className="mt-8">
          <label htmlFor="pair-code" className="text-sm text-zinc-400">
            Code
          </label>
          <input
            id="pair-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="000 000"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'pair-error' : undefined}
            className="mt-2 block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-3xl tracking-[0.3em] text-zinc-100 outline-none focus:border-cyan-400"
          />
          {error ? (
            <p id="pair-error" role="alert" className="mt-3 text-sm text-red-400">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={sending}
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-cyan-500 px-6 font-medium text-zinc-950 transition hover:bg-cyan-400 disabled:opacity-60"
          >
            {sending ? 'Checking...' : 'Connect and play'}
          </button>
        </form>
      </div>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center self-start text-sm text-zinc-500 hover:text-zinc-300">
        Back home
      </Link>
    </main>
  );
}
