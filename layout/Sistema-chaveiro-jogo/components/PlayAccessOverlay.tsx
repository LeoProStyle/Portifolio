'use client';

import Link from 'next/link';

export type PlayAccessOverlayKind = 'demo-over' | 'locked' | 'devtools';

interface PlayAccessOverlayProps {
  kind: PlayAccessOverlayKind;
  /** Seconds until a new demo is allowed ('locked' only). */
  retryInSeconds?: number;
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

const COPY: Record<PlayAccessOverlayKind, { title: string; body: string }> = {
  'demo-over': {
    title: 'Demo over',
    body: 'Tap your RetroKey NFC cartridge on your phone to keep playing this game.'
  },
  locked: {
    title: 'Demo already used',
    body: 'Tap your RetroKey NFC cartridge on your phone to play without a time limit.'
  },
  devtools: {
    title: 'Game paused',
    body: 'Close the browser developer tools to continue.'
  }
};

// Covers the stage when the game cannot run: demo time ended, demo cooldown, or developer tools open.
export default function PlayAccessOverlay({ kind, retryInSeconds }: PlayAccessOverlayProps) {
  const copy = COPY[kind];
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="play-access-title"
      data-testid={`play-access-${kind}`}
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 px-4"
    >
      <div className="w-full max-w-sm rounded-2xl border border-[color:var(--t-accent)] bg-[color:var(--t-bg)] p-6 text-center text-[color:var(--t-text)]">
        <p id="play-access-title" className="text-xl font-semibold">
          {copy.title}
        </p>
        <p className="mt-3 text-sm text-[color:var(--t-muted)]">{copy.body}</p>
        {kind === 'locked' && typeof retryInSeconds === 'number' ? (
          <p className="mt-3 text-sm">
            New demo in <span className="font-mono">{formatClock(retryInSeconds)}</span>
          </p>
        ) : null}
        {kind !== 'devtools' ? (
          <div className="mt-6 flex flex-col items-center gap-2">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-full bg-[color:var(--t-accent)] px-5 font-medium text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-text)]"
            >
              Back home
            </Link>
            <Link
              href="/connect"
              data-testid="play-access-connect"
              className="inline-flex min-h-11 items-center px-2 text-sm text-[color:var(--t-muted)] underline underline-offset-4 hover:text-[color:var(--t-text)]"
            >
              Have the cartridge? Connect this computer
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Time left in the demo, shown over the stage corner. */
export function DemoBadge({ secondsLeft }: { secondsLeft: number }) {
  return (
    <div
      data-testid="demo-badge"
      aria-live="off"
      className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white"
    >
      Demo <span className="font-mono">{formatClock(secondsLeft)}</span>
    </div>
  );
}
