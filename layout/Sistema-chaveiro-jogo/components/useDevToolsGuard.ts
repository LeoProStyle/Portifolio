'use client';

import { useEffect, useState } from 'react';

// Light deterrent against the browser developer tools on the play screen. It is not a security
// control: the browser menu, a detached DevTools window or a direct request all get around it.
// The ROM ticket checked by /api/rom/[slug] is the access control.
// - Blocks F12, Ctrl/Cmd+Shift+I/J/C, Ctrl/Cmd+U and the context menu.
// - Reports `true` while a docked DevTools panel is detected (window outer size much larger than
//   the inner size), so the caller can pause the game.
// Active only in production builds, so local development keeps the developer tools.

const SIZE_GAP_X = 160;
const SIZE_GAP_Y = 250;
const CHECK_INTERVAL_MS = 1000;

export function isBlockedDevToolsKey(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): boolean {
  const key = event.key.toLowerCase();
  if (key === 'f12') return true;
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.shiftKey && (key === 'i' || key === 'j' || key === 'c')) return true;
  // macOS: Cmd+Option+I/J/C
  if (event.metaKey && event.altKey && (key === 'i' || key === 'j' || key === 'c')) return true;
  if (mod && !event.shiftKey && key === 'u') return true;
  return false;
}

export default function useDevToolsGuard(enabled: boolean = process.env.NODE_ENV === 'production'): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isBlockedDevToolsKey(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('contextmenu', onContextMenu, true);

    // Touch devices have no docked DevTools; their outer/inner sizes differ for other reasons.
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    let timer: number | null = null;
    if (!coarse) {
      const check = () => {
        const gapX = window.outerWidth - window.innerWidth;
        const gapY = window.outerHeight - window.innerHeight;
        setOpen(gapX > SIZE_GAP_X || gapY > SIZE_GAP_Y);
      };
      check();
      timer = window.setInterval(check, CHECK_INTERVAL_MS);
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('contextmenu', onContextMenu, true);
      if (timer !== null) window.clearInterval(timer);
    };
  }, [enabled]);

  return enabled && open;
}
