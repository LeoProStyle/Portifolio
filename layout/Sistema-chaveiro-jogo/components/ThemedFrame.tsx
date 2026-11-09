'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { FrameStyle } from '@/lib/play-theme';
import type { PlayScreenState } from '@/components/StatusStrip';

// 'frame': Wide without a bezel (SF01 CSS frame). 'bezel': Wide with an adopted bezel image
// behind the window. 'bare': phone, no frame (0002F SF04, design.md Components).
export type PlayFrameMode = 'frame' | 'bezel' | 'bare';

interface ThemedFrameProps {
  frameStyle: FrameStyle;
  mode: PlayFrameMode;
  state: PlayScreenState;
  onRetry?: () => void;
  onReload?: () => void;
  // Decorative bezel image (PlayBezel), drawn behind the window in 'bezel' mode.
  bezel?: ReactNode;
  children?: ReactNode;
}

const ACTION_CLASS =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-[color:var(--t-accent)] px-6 text-sm font-semibold text-[#18181B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-text)]';

function StatePanel({ state, onRetry, onReload }: Pick<ThemedFrameProps, 'state' | 'onRetry' | 'onReload'>) {
  if (state === 'not-found') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[color:var(--t-bg)] p-4 text-center">
        <h2 className="text-lg font-semibold text-[color:var(--t-text)]">Game not found</h2>
        <p className="text-sm text-[color:var(--t-muted)]">This game is not in the catalog.</p>
        <Link href="/" className={ACTION_CLASS}>
          Back home
        </Link>
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

// The game area: the remaining stage height. The DOM tree is the same in every mode, so the bezel
// image never remounts when it is adopted; the layout of each mode lives in app/globals.css.
export default function ThemedFrame({ frameStyle, mode, state, onRetry, onReload, bezel, children }: ThemedFrameProps) {
  if (state === 'loading-metadata') {
    return (
      <div className="play-frame-area">
        <div aria-hidden="true" className="play-skeleton bg-zinc-900 motion-safe:animate-pulse" />
      </div>
    );
  }

  const showsEmulator = state === 'booting' || state === 'running';

  return (
    <div className="play-frame-area" data-mode={mode}>
      <div className="play-bezel-area">
        {bezel}
        <div className="play-window" data-window={mode} data-frame={mode === 'frame' ? frameStyle : undefined}>
          <div className={`relative h-full w-full overflow-hidden bg-black${mode === 'frame' ? ' rounded' : ''}`}>
            {showsEmulator ? children : null}
            <StatePanel state={state} onRetry={onRetry} onReload={onReload} />
          </div>
        </div>
      </div>
    </div>
  );
}
