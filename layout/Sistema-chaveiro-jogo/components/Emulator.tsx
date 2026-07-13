'use client';

import { useEffect, useState, useRef } from 'react';

interface EmulatorProps {
  gameSlug: string;
  gameTitle: string;
  core?: string;
}

const FALLBACK_TIMEOUT_MS = 10000;
const RETRY_DELAY_MS = 250;

type EmulatorState = 'loading' | 'running' | 'failed';

function getCoreCandidates(primaryCore?: string): string[] {
  const normalized = (primaryCore || 'nes').trim().toLowerCase();
  const baseCandidates: Record<string, string[]> = {
    genesis_plus_gx: ['genesis_plus_gx'],
    megadrive: ['genesis_plus_gx'],
    sega_md: ['genesis_plus_gx'],
    fceumm: ['fceumm', 'nestopia'],
    nes: ['fceumm', 'nestopia'],
    nestopia: ['nestopia', 'fceumm'],
    snes9x: ['snes9x'],
    snes: ['snes9x'],
    gambatte: ['gambatte'],
    gb: ['gambatte'],
    mgba: ['mgba'],
    gba: ['mgba', 'gba'],
    fbneo: ['fbneo', 'mame2003_plus', 'mame2003'],
    arcade: ['fbneo', 'mame2003_plus', 'mame2003'],
    mame: ['mame2003_plus', 'mame2003'],
    mame2003_plus: ['mame2003_plus', 'mame2003'],
    mame2003: ['mame2003', 'mame2003_plus'],
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

  // Ref for iframe to manage focus
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // State management for emulator lifecycle
  const stateRef = useRef<EmulatorState>('loading');
  const attemptRef = useRef({
    attemptIndex: 0,
    timeoutId: null as number | null,
    iframeUrl: '',
    currentCore: '',
    iframeElement: null as HTMLIFrameElement | null
  });
  const cancelledRef = useRef(false);

  const scheduleTimeout = (callback: () => void, delay: number) => {
    if (typeof window !== 'undefined') {
      return window.setTimeout(callback, delay);
    }
    return setTimeout(callback, delay) as unknown as number;
  };

  const clearScheduledTimeout = (timeoutId: number | null) => {
    if (timeoutId === null) return;
    if (typeof window !== 'undefined') {
      window.clearTimeout(timeoutId);
    } else {
      clearTimeout(timeoutId);
    }
  };

  // Cleanup resources for current attempt
  const cleanupCurrentAttempt = () => {
    if (attemptRef.current.timeoutId !== null) {
      clearScheduledTimeout(attemptRef.current.timeoutId);
      attemptRef.current.timeoutId = null;
    }
  };

  // Log helper with consistent format
  const logEmulator = (level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const logMessage = `[emulator] ${message}`;
    console[level](logMessage, {
      gameSlug,
      gameTitle,
      console: core,
      currentCore: attemptRef.current.currentCore,
      attemptIndex: attemptRef.current.attemptIndex + 1,
      totalAttempts: coreCandidates.length,
      state: stateRef.current,
      ...data
    });
  };

  const tryCore = (attemptIndex: number) => {
    if (cancelledRef.current) return;

    const currentCore = coreCandidates[attemptIndex];
    if (!currentCore) {
      logEmulator('error', 'No more cores available to try');
      setStatus('Unable to initialize the emulator with the available cores.');
      stateRef.current = 'failed';
      return;
    }

    stateRef.current = 'loading';
    attemptRef.current.attemptIndex = attemptIndex;
    attemptRef.current.currentCore = currentCore;

    logEmulator('info', `Trying core (${attemptIndex + 1}/${coreCandidates.length})`, { core: currentCore });
    setStatus(`Trying ${currentCore} (${attemptIndex + 1}/${coreCandidates.length})...`);
    setIframeUrl('');

    // Delay before showing iframe to allow state cleanup
    scheduleTimeout(() => {
      if (cancelledRef.current || stateRef.current === 'running') return;

      const params = new URLSearchParams({
        title: gameTitle,
        core: currentCore,
        rom: romUrl
      });

      const url = `/emulator.html?${params.toString()}`;
      attemptRef.current.iframeUrl = url;

      setIframeUrl(url);

      // Set timeout for this attempt
      const timeoutId = scheduleTimeout(() => {
        if (cancelledRef.current) return;
        
        // Only trigger fallback if still in loading state
        if (stateRef.current === 'loading') {
          logEmulator('warn', 'Core initialization timeout');
          stateRef.current = 'failed';
          setStatus(`${currentCore} did not initialize within ${FALLBACK_TIMEOUT_MS}ms. Trying next core...`);

          const nextAttempt = attemptIndex + 1;
          if (nextAttempt < coreCandidates.length) {
            window.setTimeout(() => tryCore(nextAttempt), RETRY_DELAY_MS);
          } else {
            logEmulator('error', 'All cores exhausted - emulator initialization failed');
            setStatus('All cores exhausted. Unable to initialize emulator.');
            stateRef.current = 'failed';
          }
        }
      }, FALLBACK_TIMEOUT_MS);

      attemptRef.current.timeoutId = timeoutId;
    }, RETRY_DELAY_MS);
  };

  useEffect(() => {
    cancelledRef.current = false;
    stateRef.current = 'loading';

    // Listen for canvas ready signal from iframe (generic for any core/console)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'EMULATOR_CANVAS_READY') {
        // Ignore if not in loading state or component is cancelled
        if (cancelledRef.current || stateRef.current !== 'loading') return;

        // Mark as running and prevent any further fallback attempts
        stateRef.current = 'running';
        cleanupCurrentAttempt();

        logEmulator('info', 'Core initialized successfully');
        logEmulator('info', `Running with core: ${attemptRef.current.currentCore}`);
        setStatus(`Running: ${attemptRef.current.currentCore}`);
      }
    };

    window.addEventListener('message', handleMessage);
    tryCore(0);

    return () => {
      cancelledRef.current = true;
      window.removeEventListener('message', handleMessage);
      cleanupCurrentAttempt();
    };
  }, [gameSlug, gameTitle, core]);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-300">
        {status}
      </div>
      {iframeUrl ? (
        <iframe
          ref={iframeRef}
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
          tabIndex={0}
          onLoad={() => {
            logEmulator('info', 'iframe loaded (document ready)', { url: iframeUrl });
          }}
          onError={() => {
            // Immediate fallback on iframe network/security error
            if (cancelledRef.current) return;
            
            // Only trigger fallback if still in loading state
            if (stateRef.current === 'loading') {
              cleanupCurrentAttempt();
              stateRef.current = 'failed';

              const attemptIndex = attemptRef.current.attemptIndex || 0;
              const currentCore = attemptRef.current.currentCore;

              logEmulator('error', `iframe error - triggering fallback for core: ${currentCore}`);
              setStatus(`${currentCore} failed to load. Trying next core...`);

              const nextAttempt = attemptIndex + 1;
              if (nextAttempt < coreCandidates.length) {
                scheduleTimeout(() => tryCore(nextAttempt), RETRY_DELAY_MS);
              } else {
                logEmulator('error', 'All cores exhausted on iframe error');
                setStatus('All cores failed. Unable to initialize emulator.');
                stateRef.current = 'failed';
              }
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
