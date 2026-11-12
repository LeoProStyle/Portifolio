"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Pairing =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; code: string; endsAt: number }
  | { state: 'error'; message: string };

function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function NfcPage({ params }: { params: { id: string } }) {
  const [status, setStatus] = useState('Validating cartridge...');
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [gameSlug, setGameSlug] = useState<string | null>(null);
  const [pairing, setPairing] = useState<Pairing>({ state: 'idle' });
  const [now, setNow] = useState(() => Date.now());
  const [connectUrl, setConnectUrl] = useState('/connect');

  useEffect(() => {
    setConnectUrl(`${window.location.origin}/connect`);
  }, []);

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
        setGameSlug(data.game.slug);
      } catch (error) {
        setStatus('Validation failed.');
      }
    };

    validate();
  }, [params.id]);

  // Countdown of the pairing code.
  useEffect(() => {
    if (pairing.state !== 'ready') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pairing]);

  const requestCode = async () => {
    if (!gameSlug) return;
    setPairing({ state: 'loading' });
    try {
      const response = await fetch('/api/pair/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: gameSlug })
      });
      const data = await response.json();
      if (!response.ok) {
        setPairing({ state: 'error', message: data.error || 'Could not create a code.' });
        return;
      }
      setNow(Date.now());
      setPairing({ state: 'ready', code: data.code, endsAt: Date.now() + data.expiresInSeconds * 1000 });
    } catch {
      setPairing({ state: 'error', message: 'Could not create a code.' });
    }
  };

  const secondsLeft = pairing.state === 'ready' ? (pairing.endsAt - now) / 1000 : 0;
  const codeExpired = pairing.state === 'ready' && secondsLeft <= 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">NFC validation</p>
        <h1 className="mt-4 text-3xl font-semibold">Cartridge detected: {params.id}</h1>
        <p className="mt-4 text-zinc-300">{status}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {redirectTo ? (
            <>
              <Link
                href={redirectTo}
                className="inline-flex min-h-11 items-center rounded-full bg-cyan-500 px-5 font-medium text-zinc-950 transition hover:bg-cyan-400"
              >
                Play on this device
              </Link>
              <button
                type="button"
                onClick={requestCode}
                disabled={pairing.state === 'loading'}
                className="inline-flex min-h-11 items-center rounded-full border border-zinc-700 px-5 font-medium text-zinc-100 transition hover:border-cyan-400 disabled:opacity-60"
              >
                {pairing.state === 'ready' || pairing.state === 'error' ? 'New code for a computer' : 'Play on a computer'}
              </button>
            </>
          ) : (
            <span className="text-zinc-500">Waiting for validation response...</span>
          )}
        </div>

        {pairing.state === 'loading' ? <p className="mt-6 text-zinc-400">Creating code...</p> : null}
        {pairing.state === 'error' ? (
          <p role="alert" className="mt-6 text-red-400">
            {pairing.message}
          </p>
        ) : null}
        {pairing.state === 'ready' ? (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6" aria-live="polite">
            <p className="text-sm text-zinc-400">
              On the computer, open <span className="break-all font-mono text-zinc-200">{connectUrl}</span> and type:
            </p>
            <p
              data-testid="pair-code"
              className={`mt-4 font-mono text-4xl font-semibold tracking-[0.2em] ${codeExpired ? 'text-zinc-600 line-through' : 'text-cyan-300'}`}
            >
              {formatCode(pairing.code)}
            </p>
            <p className="mt-3 text-sm text-zinc-500">
              {codeExpired ? 'Code expired. Ask for a new one.' : `Valid for ${formatClock(secondsLeft)} · single use`}
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
