'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

interface PlayTopBarProps {
  title: string;
  systemLabel?: string;
  // Content of the 44x44 fullscreen cell. Empty in SF01; SF02 fills it.
  children?: ReactNode;
}

// Back home is the first focusable element of the play screen (design.md Components, tab order).
export default function PlayTopBar({ title, systemLabel, children }: PlayTopBarProps) {
  return (
    <header className="flex shrink-0 items-center gap-2 px-2 py-1 sm:px-4 [@media(max-height:480px)]:py-0">
      <Link
        href="/"
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-[color:var(--t-text)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-accent)]"
      >
        <span aria-hidden="true">←</span>
        <span>Back home</span>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col [@media(max-height:480px)]:flex-row [@media(max-height:480px)]:items-baseline [@media(max-height:480px)]:gap-2">
        <h1 className="truncate text-lg font-semibold text-[color:var(--t-text)] sm:text-2xl [@media(max-height:480px)]:text-base">
          {title}
        </h1>
        {systemLabel ? (
          <p className="truncate text-xs uppercase tracking-[0.2em] text-[color:var(--t-accent)]">{systemLabel}</p>
        ) : null}
      </div>
      <div data-slot="fullscreen" className="h-11 w-11 shrink-0">
        {children}
      </div>
    </header>
  );
}
