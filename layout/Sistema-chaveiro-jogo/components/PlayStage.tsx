'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import Emulator, { type EmulatorStatus } from '@/components/Emulator';
import PlayTopBar from '@/components/PlayTopBar';
import StatusStrip, { type PlayScreenState } from '@/components/StatusStrip';
import ThemedFrame from '@/components/ThemedFrame';
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

const META_TO_SCREEN: Record<Exclude<MetaState, 'ok'>, PlayScreenState> = {
  loading: 'loading-metadata',
  'not-found': 'not-found',
  'metadata-error': 'metadata-error'
};

// Full-viewport play stage (design.md 0002F SF01, Screens). The theme is applied only as
// inline custom properties on this element; nothing from the theme reaches the iframe.
export default function PlayStage({ slug, game, metaState, onRetry }: PlayStageProps) {
  const [bootKey, setBootKey] = useState(0);
  const [emulator, setEmulator] = useState<EmulatorReport>({ state: 'booting' });

  const system = game?.system ?? game?.console ?? '';
  const ready = metaState === 'ok' && game !== null;
  const core = useMemo(() => getCoreForSystem(system), [system]);
  const theme = resolvePlayTheme(ready ? system : null);
  const screenState: PlayScreenState = ready ? emulator.state : META_TO_SCREEN[metaState === 'ok' ? 'loading' : metaState];
  const title = game?.title || slug;

  const handleStatusChange = useCallback((state: EmulatorStatus, attempt: number, total: number, core: string) => {
    setEmulator({ state, attempt, total, core });
  }, []);

  const handleReload = useCallback(() => {
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
        <ThemedFrame frameStyle={theme.frame} state={screenState} onRetry={onRetry} onReload={handleReload}>
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

        <StatusStrip
          state={screenState}
          attempt={emulator.attempt}
          total={emulator.total}
          coreName={emulator.core}
        />

        {/* SF02 mount points. Empty here; neither changes the frame size. */}
        <div data-slot="legend" className="hidden h-10 shrink-0 [@media(pointer:fine)]:block" />
        <div data-slot="touch-overlay" className="pointer-events-none absolute inset-0 hidden [@media(pointer:coarse)]:block" />
      </div>
    </div>
  );
}
