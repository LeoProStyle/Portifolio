'use client';

import type { ReactNode } from 'react';
import type { FrameStyle } from '@/lib/play-theme';
import type { PlayScreenState } from '@/components/StatusStrip';

interface ThemedFrameProps {
  frameStyle: FrameStyle;
  state: PlayScreenState;
  onRetry?: () => void;
  onReload?: () => void;
  children?: ReactNode;
}

const ACTION_CLASS =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-[color:var(--t-accent)] px-5 text-sm font-semibold text-[#18181B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-text)]';

function StatePanel({ state, onRetry, onReload }: Pick<ThemedFrameProps, 'state' | 'onRetry' | 'onReload'>) {
  if (state === 'not-found') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[color:var(--t-bg)] p-4 text-center">
        <h2 className="text-lg font-semibold text-[color:var(--t-text)]">Game not found</h2>
        <p className="text-sm text-[color:var(--t-muted)]">This game is not in the catalog.</p>
      </div>
    );
  }

  if (state === 'metadata-error' || state === 'failed') {
    const message =
      state === 'failed'
        ? 'Could not start this game. Check your connection and try again.'
        : 'Could not load game info.';
    const action = state === 'failed' ? { label: 'Reload', onClick: onReload } : { label: 'Retry', onClick: onRetry };
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[color:var(--t-bg)] p-4 text-center">
        <p role="alert" className="max-w-xs text-sm text-[color:var(--t-text)]">
          {message}
        </p>
        <button type="button" onClick={action.onClick} className={ACTION_CLASS}>
          {action.label}
        </button>
      </div>
    );
  }

  return null;
}

// The game area: the remaining stage height, with the console bezel drawn around the emulator.
// The frame keeps the console aspect ratio inside this area (rules in app/globals.css).
export default function ThemedFrame({ frameStyle, state, onRetry, onReload, children }: ThemedFrameProps) {
  if (state === 'loading-metadata') {
    return (
      <div className="flex min-h-0 flex-1 p-2">
        <div aria-hidden="true" className="h-full w-full rounded-2xl bg-zinc-900 motion-safe:animate-pulse" />
      </div>
    );
  }

  const showsEmulator = state === 'booting' || state === 'running' || state === 'failed';

  return (
    <div className="play-frame-area flex min-h-0 flex-1 items-center justify-center p-2">
      <div data-frame={frameStyle}>
        <div className="relative h-full w-full overflow-hidden rounded bg-black">
          {showsEmulator ? children : null}
          <StatePanel state={state} onRetry={onRetry} onReload={onReload} />
        </div>
      </div>
    </div>
  );
}
