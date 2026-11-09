'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Emulator, { type EmulatorStatus } from '@/components/Emulator';
import PlayBezel from '@/components/PlayBezel';
import PlayTopBar from '@/components/PlayTopBar';
import StatusStrip, { type PlayScreenState } from '@/components/StatusStrip';
import ThemedFrame, { type PlayFrameMode } from '@/components/ThemedFrame';
import useWideScreen from '@/components/useWideScreen';
import type { BezelConsoleId } from '@/lib/bezel-console';
import { getCoreForSystem } from '@/lib/emulator-cores';
import { playThemeCssVars, resolvePlayTheme } from '@/lib/play-theme';

export type PlayGameMeta = { title: string; system?: string; console?: string };
export type MetaState = 'loading' | 'not-found' | 'metadata-error' | 'ok';

interface PlayStageProps {
  slug: string;
  game: PlayGameMeta | null;
  metaState: MetaState;
  onRetry: () => void;
}

type EmulatorReport = { state: EmulatorStatus; attempt?: number; total?: number; core?: string };

// 'pending': PlayBezel mounted, image not settled. 'adopted' and 'refused' are final for this mount
// (PlayStage is keyed by slug); Reload does not reset them (0002F SF04, plan.md Hooks & State).
type BezelState = 'none' | 'pending' | 'adopted' | 'refused';

const META_TO_SCREEN: Record<Exclude<MetaState, 'ok'>, PlayScreenState> = {
  loading: 'loading-metadata',
  'not-found': 'not-found',
  'metadata-error': 'metadata-error'
};

// Full-viewport play stage (design.md 0002F SF01 Screens, SF04 modes). The theme is applied only as
// inline custom properties on this element; nothing from the theme reaches the iframe.
export default function PlayStage({ slug, game, metaState, onRetry }: PlayStageProps) {
  const [bootKey, setBootKey] = useState(0);
  const [emulator, setEmulator] = useState<EmulatorReport>({ state: 'booting' });
  const [bezel, setBezel] = useState<BezelState>('none');
  // Latest emulator state, read when the bezel image settles (the image event can come before a re-render).
  const statusRef = useRef<EmulatorStatus>('booting');
  const wide = useWideScreen();

  const system = game?.system ?? game?.console ?? '';
  const ready = metaState === 'ok' && game !== null;
  const core = useMemo(() => (ready ? getCoreForSystem(system) : ''), [ready, system]);
  const theme = resolvePlayTheme(ready ? system : null);
  const screenState: PlayScreenState = metaState === 'ok' ? emulator.state : META_TO_SCREEN[metaState];
  const title = game?.title || slug;

  const bezelId: BezelConsoleId | null = ready && theme.frame !== 'neutral' ? theme.frame : null;
  const frameMode: PlayFrameMode = !wide ? 'bare' : bezel === 'adopted' ? 'bezel' : 'frame';
  const mountBezel = wide && ready && bezelId !== null && (bezel === 'pending' || bezel === 'adopted');

  // The bezel is requested only in Wide while the game boots; once the game leaves booting
  // an unsettled bezel is refused, so the window box never changes after running (RN04).
  useEffect(() => {
    if (bezel === 'none' && wide && bezelId !== null && emulator.state === 'booting') {
      setBezel('pending');
    } else if ((bezel === 'none' || bezel === 'pending') && emulator.state !== 'booting') {
      setBezel('refused');
    }
  }, [wide, ready, bezelId, emulator.state, bezel]);

  const handleBezelLoaded = useCallback(() => {
    setBezel((current) => (current === 'pending' ? (statusRef.current === 'booting' ? 'adopted' : 'refused') : current));
  }, []);

  const handleBezelFailed = useCallback(() => {
    setBezel((current) => (current === 'pending' ? 'refused' : current));
  }, []);

  const handleStatusChange = useCallback((state: EmulatorStatus, attempt: number, total: number, core: string) => {
    statusRef.current = state;
    setEmulator({ state, attempt, total, core });
  }, []);

  const handleReload = useCallback(() => {
    statusRef.current = 'booting';
    setEmulator({ state: 'booting' });
    setBootKey((key) => key + 1);
  }, []);

  const style = playThemeCssVars(theme) as CSSProperties;

  return (
    <div
      data-testid="play-stage"
      style={style}
      className="relative flex h-screen flex-col overflow-hidden bg-[color:var(--t-bg)] text-[color:var(--t-text)] supports-[height:100dvh]:h-dvh"
    >
      <PlayTopBar title={title} systemLabel={ready ? system : undefined} />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <ThemedFrame
          frameStyle={theme.frame}
          mode={frameMode}
          state={screenState}
          onRetry={onRetry}
          onReload={handleReload}
          bezel={
            mountBezel && bezelId !== null ? (
              <PlayBezel consoleId={bezelId} onLoaded={handleBezelLoaded} onFailed={handleBezelFailed} />
            ) : null
          }
        >
          {ready ? (
            <Emulator
              key={bootKey}
              gameSlug={slug}
              gameTitle={title}
              core={core}
              onStatusChange={handleStatusChange}
            />
          ) : null}
        </ThemedFrame>

        {/* Phone: absolute strip over the stage bottom (this parent is relative). Wide: a row in the flow. */}
        <StatusStrip
          state={screenState}
          attempt={emulator.attempt}
          total={emulator.total}
          coreName={emulator.core}
        />

        {/* SF02 mount points. Empty here; neither changes the window size. */}
        <div data-slot="legend" className="hidden h-10 shrink-0 wide:block" />
        <div data-slot="touch-overlay" className="pointer-events-none absolute inset-0 hidden [@media(pointer:coarse)]:block" />
      </div>
    </div>
  );
}
