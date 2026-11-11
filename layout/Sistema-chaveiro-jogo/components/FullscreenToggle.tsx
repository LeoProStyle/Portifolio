'use client';

import { useEffect, useState, type RefObject } from 'react';

interface FullscreenToggleProps {
  targetRef: RefObject<HTMLElement>;
}

// Full screen of the play stage (0002F SF02). Renders nothing where the API is missing.
export default function FullscreenToggle({ targetRef }: FullscreenToggleProps) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);

  useEffect(() => {
    setSupported(typeof document !== 'undefined' && document.fullscreenEnabled === true);
    const sync = () => setOn(document.fullscreenElement !== null && document.fullscreenElement === targetRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [targetRef]);

  if (!supported) return null;

  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await targetRef.current?.requestFullscreen();
    } catch {
      // A refused request leaves the button off, with no message (design.md Flows).
    }
  };

  const label = on ? 'Exit full screen' : 'Full screen';
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={toggle}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md text-[color:var(--t-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-accent)]"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {on ? (
          <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
        ) : (
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        )}
      </svg>
    </button>
  );
}
