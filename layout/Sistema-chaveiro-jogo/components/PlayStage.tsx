'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import ControlsLegend from '@/components/ControlsLegend';
import Emulator, { type EmulatorHandle, type EmulatorStatus } from '@/components/Emulator';
import FullscreenToggle from '@/components/FullscreenToggle';
import KeysPanel from '@/components/KeysPanel';
import PlayAccessOverlay, { DemoBadge } from '@/components/PlayAccessOverlay';
import PlayBezel from '@/components/PlayBezel';
import PlayTopBar from '@/components/PlayTopBar';
import StatusStrip, { type PlayScreenState } from '@/components/StatusStrip';
import ThemedFrame, { type PlayFrameMode } from '@/components/ThemedFrame';
import useControlMap from '@/components/useControlMap';
import useDevToolsGuard from '@/components/useDevToolsGuard';
import useWideScreen from '@/components/useWideScreen';
import VirtualController from '@/components/VirtualController';
import type { BezelConsoleId } from '@/lib/bezel-console';
import { getCoreForSystem } from '@/lib/emulator-cores';
import { buttonIndex, consoleIdForSystem, toControlsMessage, type ConsoleButton } from '@/lib/emulator-controls';
import { pickTextColor, playThemeCssVars, resolvePlayTheme } from '@/lib/play-theme';

export type PlayGameMeta = { title: string; system?: string; console?: string };
export type MetaState = 'loading' | 'not-found' | 'metadata-error' | 'ok';
// Response of POST /api/play/[slug]/session.
export type PlayAccess =
  | { mode: 'full'; romUrl: string; remainingSeconds: number }
  | { mode: 'demo'; romUrl: string; remainingSeconds: number }
  | { mode: 'locked'; retryInSeconds: number };

interface PlayStageProps {
  slug: string;
  game: PlayGameMeta | null;
  metaState: MetaState;
  // Set together with metaState 'ok'.
  access: PlayAccess | null;
  onRetry: () => void;
}

/** Seconds left until `deadline` (ms), updated every second; null when there is no deadline. */
function useSecondsLeft(deadline: number | null): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === null) {
      setLeft(null);
      return;
    }
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return left;
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
export default function PlayStage({ slug, game, metaState, access, onRetry }: PlayStageProps) {
  const [bootKey, setBootKey] = useState(0);
  const [emulator, setEmulator] = useState<EmulatorReport>({ state: 'booting' });
  const [bezel, setBezel] = useState<BezelState>('none');
  // Latest emulator state, read when the bezel image settles (the image event can come before a re-render).
  const statusRef = useRef<EmulatorStatus>('booting');
  const wide = useWideScreen();
  const stageRef = useRef<HTMLDivElement>(null);
  const emulatorRef = useRef<EmulatorHandle>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const [keysOpen, setKeysOpen] = useState(false);

  const system = game?.system ?? game?.console ?? '';
  const ready = metaState === 'ok' && game !== null && access !== null;

  // Demo end and cooldown are counted from the server's remaining seconds, not the client clock.
  const demoDeadline = useMemo(
    () => (access?.mode === 'demo' ? Date.now() + access.remainingSeconds * 1000 : null),
    [access]
  );
  const lockDeadline = useMemo(
    () => (access?.mode === 'locked' ? Date.now() + access.retryInSeconds * 1000 : null),
    [access]
  );
  const demoLeft = useSecondsLeft(demoDeadline);
  const lockLeft = useSecondsLeft(lockDeadline);
  const demoOver = access?.mode === 'demo' && demoLeft === 0;
  const devToolsOpen = useDevToolsGuard();
  const canPlay = ready && access?.mode !== 'locked' && !demoOver;
  const romUrl = access && access.mode !== 'locked' ? access.romUrl : '';
  const core = useMemo(() => (ready ? getCoreForSystem(system) : ''), [ready, system]);
  const theme = resolvePlayTheme(ready ? system : null);
  const screenState: PlayScreenState = metaState === 'ok' ? emulator.state : META_TO_SCREEN[metaState];
  const title = game?.title || slug;

  // Controls follow the game's system, never the theme frame (0002F SF02, plan.md Hooks & State).
  const consoleId = useMemo(() => (ready ? consoleIdForSystem(system) : null), [ready, system]);
  const controls = useControlMap(consoleId);
  const controlsMessage = useMemo(
    () => (consoleId && controls.map ? toControlsMessage(controls.map, consoleId) : null),
    [consoleId, controls.map]
  );

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

  const handleInput = useCallback(
    (button: ConsoleButton, pressed: boolean) => {
      if (!consoleId) return;
      const index = buttonIndex(consoleId, button);
      if (index !== null) emulatorRef.current?.sendInput(index, pressed);
    },
    [consoleId]
  );

  const handleKeysOpen = useCallback(() => {
    emulatorRef.current?.releaseAll();
    setKeysOpen(true);
  }, []);

  // Focus goes back to the game only after the key that closed the panel is released, so the
  // Enter of Done never reaches the game as Start (design.md C6).
  const handleKeysClose = useCallback(() => {
    setKeysOpen(false);
    let done = false;
    const onKeyUp = () => {
      if (done) return;
      done = true;
      window.removeEventListener('keyup', onKeyUp, true);
      window.requestAnimationFrame(() => {
        if (!emulatorRef.current?.focusGame()) editButtonRef.current?.focus();
      });
    };
    window.addEventListener('keyup', onKeyUp, true);
    window.setTimeout(onKeyUp, 400);
  }, []);

  useEffect(() => {
    const handle = emulatorRef;
    return () => handle.current?.releaseAll();
  }, []);

  const shellTone = pickTextColor(theme.frameColor) === '#18181B' ? 'light' : 'dark';
  const style = {
    ...playThemeCssVars(theme),
    '--t-on-frame': pickTextColor(theme.frameColor)
  } as CSSProperties;
  const led = screenState === 'running' ? 'on' : screenState === 'booting' ? 'boot' : 'off';

  return (
    <div
      ref={stageRef}
      data-testid="play-stage"
      style={style}
      className="relative flex h-screen flex-col overflow-hidden bg-[color:var(--t-bg)] text-[color:var(--t-text)] supports-[height:100dvh]:h-dvh"
    >
      <PlayTopBar title={title} systemLabel={ready ? system : undefined}>
        <FullscreenToggle targetRef={stageRef} />
      </PlayTopBar>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Phone held upright with touch: the handheld body (app/globals.css). Elsewhere these
            wrappers are display: contents, so the SF04 layout is unchanged. */}
        <div className="play-shell" data-shell={shellTone}>
          <div className="play-screen">
            <div className="play-screen-top" aria-hidden="true">
              <span className="play-led" data-led={led} />
              <span className="play-led-label">Power</span>
            </div>
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
          {canPlay ? (
            <Emulator
              ref={emulatorRef}
              key={bootKey}
              gameSlug={slug}
              gameTitle={title}
              core={core}
              romUrl={romUrl}
              paused={devToolsOpen}
              onStatusChange={handleStatusChange}
              consoleId={consoleId}
              controls={controlsMessage}
            />
          ) : null}
        </ThemedFrame>

            {/* Phone: absolute strip over the stage bottom, or over the screen glass in the handheld
                body. Wide: a row in the flow. */}
            <StatusStrip
              state={screenState}
              attempt={emulator.attempt}
              total={emulator.total}
              coreName={emulator.core}
            />
          </div>
          <p className="play-brand" aria-hidden="true">
            <span className="play-brand-name">RetroKey</span>
            <span>{ready ? system : ''}</span>
          </p>
          <div data-slot="touch-overlay" className="play-touch">
            {consoleId ? <VirtualController consoleId={consoleId} status={screenState} onInput={handleInput} /> : null}
          </div>
        </div>

        {access?.mode === 'demo' && !demoOver && demoLeft !== null ? <DemoBadge secondsLeft={demoLeft} /> : null}
        {ready && access?.mode === 'locked' ? <PlayAccessOverlay kind="locked" retryInSeconds={lockLeft ?? access.retryInSeconds} /> : null}
        {demoOver ? <PlayAccessOverlay kind="demo-over" /> : null}
        {canPlay && devToolsOpen ? <PlayAccessOverlay kind="devtools" /> : null}

        {/* Wide key legend; it never changes the window size. */}
        <div data-slot="legend" className="hidden h-10 shrink-0 wide:block">
          <ControlsLegend
            consoleId={consoleId}
            map={controls.map}
            status={screenState}
            onEdit={handleKeysOpen}
            editButtonRef={editButtonRef}
          />
        </div>
      </div>

      {consoleId && controls.map ? (
        <KeysPanel
          consoleId={consoleId}
          map={controls.map}
          hasSaved={controls.hasSaved}
          storageOk={controls.storageOk}
          open={keysOpen}
          onRemap={controls.remap}
          onReset={controls.reset}
          onClose={handleKeysClose}
        />
      ) : null}
    </div>
  );
}
