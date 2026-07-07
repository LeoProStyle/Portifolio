'use client';

import { useEffect, useState, useRef } from 'react';

interface EmulatorProps {
  gameSlug: string;
  gameTitle: string;
  core?: string;
}

const FALLBACK_TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 250;

function getCoreCandidates(primaryCore?: string): string[] {
  const normalized = (primaryCore || 'nes').trim().toLowerCase();
  const baseCandidates: Record<string, string[]> = {
    genesis_plus_gx: ['genesis_plus_gx'],
    megadrive: ['genesis_plus_gx'],
    sega_md: ['genesis_plus_gx'],
    fceumm: ['fceumm', 'nestopia'],
    nes: ['nes', 'fceumm', 'nestopia'],
    snes9x: ['snes9x'],
    snes: ['snes9x'],
    gambatte: ['gambatte'],
    gb: ['gambatte'],
    mgba: ['mgba'],
    gba: ['gba', 'mgba'],
    fbneo: ['fbneo'],
    arcade: ['fbneo'],
    pcsx_rearmed: ['pcsx_rearmed'],
    psx: ['pcsx_rearmed'],
    mupen64plus_next: ['mupen64plus_next'],
    n64: ['mupen64plus_next']
  };

  const candidates = baseCandidates[normalized] || [normalized];
  return Array.from(new Set(candidates));
}

export default function Emulator({ gameSlug, gameTitle, core = 'nes' }: EmulatorProps) {
  const [iframeUrl, setIframeUrl] = useState<string>('');
  const [status, setStatus] = useState<string>('Preparing emulator...');
  const romUrl = `/api/rom/${gameSlug}`;
  const coreCandidates = getCoreCandidates(core);
  const attemptRef = useRef({ attemptIndex: 0, timeoutId: null as number | null, iframeUrl: '', currentCore: '' });
  const cancelledRef = useRef(false);

  const tryCore = (attemptIndex: number) => {
    if (cancelledRef.current) return;

    const currentCore = coreCandidates[attemptIndex];
    if (!currentCore) {
      setStatus('Unable to initialize the emulator with the available cores.');
      return;
    }

    console.info('[emulator] Trying core', { gameSlug, gameTitle, core: currentCore, attempt: attemptIndex + 1 });
    setStatus(`Trying core ${currentCore} (${attemptIndex + 1}/${coreCandidates.length})...`);
    setIframeUrl('');

    window.setTimeout(() => {
      if (cancelledRef.current) return;

      const params = new URLSearchParams({
        title: gameTitle,
        core: currentCore,
        rom: romUrl
      });

      // Do not rely on messages from the emulator. Consider failure only when
      // the iframe triggers an error or when the timeout expires.
      const url = `/emulator.html?${params.toString()}`;
      attemptRef.current.attemptIndex = attemptIndex;
      attemptRef.current.currentCore = currentCore;
      attemptRef.current.iframeUrl = url;

      setIframeUrl(url);

      const timeoutId = window.setTimeout(() => {
        if (cancelledRef.current) return;
        console.warn('[emulator] Core timeout', { gameSlug, gameTitle, core: currentCore });
        setStatus(`Core ${currentCore} did not initialize. Trying the next fallback...`);

        const nextAttempt = attemptIndex + 1;
        if (nextAttempt < coreCandidates.length) {
          window.setTimeout(() => tryCore(nextAttempt), RETRY_DELAY_MS);
        } else {
          setStatus('The emulator could not be initialized with the available cores.');
        }
      }, FALLBACK_TIMEOUT_MS);

      attemptRef.current.timeoutId = timeoutId;
    }, RETRY_DELAY_MS);
  };

  useEffect(() => {
    cancelledRef.current = false;

    // Listen for canvas ready signal from iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'EMULATOR_CANVAS_READY') {
        console.info('[emulator] Core initialized successfully.');
        if (attemptRef.current.timeoutId !== null) {
          window.clearTimeout(attemptRef.current.timeoutId);
          attemptRef.current.timeoutId = null;
        }
        setStatus(`${attemptRef.current.currentCore} initialized.`);
      }
    };

    window.addEventListener('message', handleMessage);

    tryCore(0);
    return () => {
      cancelledRef.current = true;
      window.removeEventListener('message', handleMessage);
      if (attemptRef.current.timeoutId !== null) {
        window.clearTimeout(attemptRef.current.timeoutId);
      }
    };
  }, [gameSlug, gameTitle, core]);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-300">
        {status}
      </div>
      {iframeUrl ? (
        <iframe
          key={iframeUrl}
          src={iframeUrl}
          style={{
            width: '100%',
            height: '600px',
            border: 'none',
            borderRadius: '0.5rem'
          }}
          title={`Play ${gameTitle}`}
          allow="fullscreen"
          onLoad={() => {
            console.info('[emulator] iframe loaded', { gameSlug, gameTitle, core, iframeUrl });
            // Note: Do NOT cancel the fallback timeout on load; loader.js may load
            // but the emulator may still fail to initialize. Success is assumed
            // unless an error or timeout occurs.
          }}
          onError={() => {
            // Immediate fallback on iframe error for the current attempt
            if (attemptRef.current.timeoutId !== null) {
              window.clearTimeout(attemptRef.current.timeoutId);
            }
            const attemptIndex = attemptRef.current.attemptIndex || 0;
            const currentCore = attemptRef.current.currentCore;
            console.error('[emulator] iframe error', { gameSlug, gameTitle, core: currentCore });
            setStatus(`Core ${currentCore} failed to load. Trying next fallback...`);
            const nextAttempt = attemptIndex + 1;
            if (nextAttempt < coreCandidates.length) {
              window.setTimeout(() => tryCore(nextAttempt), RETRY_DELAY_MS);
            } else {
              setStatus('The emulator could not be initialized with the available cores.');
            }
          }}
        />
      ) : (
        <div className="flex h-96 items-center justify-center text-zinc-400">
          Loading emulator...
        </div>
      )}
    </div>
  );
}
