'use client';

import { useEffect, useRef } from 'react';
import type { BezelConsoleId } from '@/lib/bezel-console';

interface PlayBezelProps {
  consoleId: BezelConsoleId;
  onLoaded: () => void;
  onFailed: () => void;
}

// Decorative console bezel (0002F SF04). Never lazy: it must load while hidden behind the frame.
export default function PlayBezel({ consoleId, onLoaded, onFailed }: PlayBezelProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  // Console id whose result was already reported, so each image reports once (also under Strict Mode).
  const settledRef = useRef<BezelConsoleId | null>(null);

  const report = (loaded: boolean) => {
    if (settledRef.current === consoleId) return;
    settledRef.current = consoleId;
    if (loaded) onLoaded();
    else onFailed();
  };

  // The image can finish before hydration attaches onLoad/onError; read its state after mount.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete) report(img.naturalWidth > 0);
    // Only the console id changes the image; the callbacks are read at report time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleId]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      className="play-bezel-img"
      src={`/api/bezel/${consoleId}`}
      alt=""
      aria-hidden="true"
      onLoad={(event) => report(event.currentTarget.naturalWidth > 0)}
      onError={() => report(false)}
    />
  );
}
