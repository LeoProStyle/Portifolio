'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react';
import type { BezelConsoleId } from '@/lib/bezel-console';
import { buttonLabel, type ConsoleButton } from '@/lib/emulator-controls';
import type { PlayScreenState } from '@/components/StatusStrip';

interface VirtualControllerProps {
  consoleId: BezelConsoleId;
  status: PlayScreenState;
  onInput: (button: ConsoleButton, pressed: boolean) => void;
}

// One set of buttons per console (0002F SF02 design.md "Modo portátil" and "Botões de ação por console").
// app/globals.css lays it out as the handheld deck in portrait and as side bands in landscape,
// so turning the phone never remounts anything.

type Face = { button: ConsoleButton; x: number; y: number; size: number; fill: string; fg: string; text?: string };
type Layout = {
  faces: readonly Face[];
  box?: 'wide';
  shouldersLeft: readonly ConsoleButton[];
  shouldersRight: readonly ConsoleButton[];
  shoulderCenter: readonly ConsoleButton[];
  menuLeft: readonly ConsoleButton[];
  menuRight: readonly ConsoleButton[];
  pad: 'dpad' | 'stick' | 'n64';
};

const WHITE = '#FFFFFF';
const INK = '#18181B';
const ACCENT = 'var(--t-accent)';

function diagonal(first: ConsoleButton, second: ConsoleButton, fill: string, fg: string): Face[] {
  return [
    { button: first, x: 28, y: 64, size: 40, fill, fg },
    { button: second, x: 72, y: 36, size: 40, fill, fg }
  ];
}

function diamond(top: Face['button'], left: Face['button'], right: Face['button'], bottom: Face['button']) {
  return { top, left, right, bottom };
}

const SNES = diamond('x', 'y', 'a', 'b');
const PS = diamond('triangle', 'square', 'circle', 'cross');

const LAYOUTS: Record<BezelConsoleId, Layout> = {
  nes: {
    faces: [
      { button: 'b', x: 27, y: 56, size: 40, fill: '#C8102E', fg: WHITE },
      { button: 'a', x: 73, y: 44, size: 40, fill: '#C8102E', fg: WHITE }
    ],
    shouldersLeft: [],
    shouldersRight: [],
    shoulderCenter: [],
    menuLeft: ['select'],
    menuRight: ['start'],
    pad: 'dpad'
  },
  dmg: {
    faces: diagonal('b', 'a', '#9A2257', WHITE),
    shouldersLeft: [],
    shouldersRight: [],
    shoulderCenter: [],
    menuLeft: ['select'],
    menuRight: ['start'],
    pad: 'dpad'
  },
  gbc: {
    faces: diagonal('b', 'a', '#E4E4EA', INK),
    shouldersLeft: [],
    shouldersRight: [],
    shoulderCenter: [],
    menuLeft: ['select'],
    menuRight: ['start'],
    pad: 'dpad'
  },
  gba: {
    faces: diagonal('b', 'a', '#D9D9E3', INK),
    shouldersLeft: ['l'],
    shouldersRight: ['r'],
    shoulderCenter: [],
    menuLeft: ['select'],
    menuRight: ['start'],
    pad: 'dpad'
  },
  snes: {
    faces: [
      { button: SNES.top, x: 50, y: 18, size: 32, fill: '#3B5BA9', fg: WHITE },
      { button: SNES.left, x: 18, y: 50, size: 32, fill: '#1E8F4E', fg: WHITE },
      { button: SNES.right, x: 82, y: 50, size: 32, fill: '#C8102E', fg: WHITE },
      { button: SNES.bottom, x: 50, y: 82, size: 32, fill: '#E0B020', fg: INK }
    ],
    shouldersLeft: ['l'],
    shouldersRight: ['r'],
    shoulderCenter: [],
    menuLeft: ['select'],
    menuRight: ['start'],
    pad: 'dpad'
  },
  n64: {
    box: 'wide',
    faces: [
      // U+FE0E keeps the arrows as text glyphs instead of color emoji.
      { button: 'c-up', x: 62, y: 13, size: 26, fill: '#E8B000', fg: INK, text: '▲︎' },
      { button: 'c-left', x: 38, y: 37, size: 26, fill: '#E8B000', fg: INK, text: '◀︎' },
      { button: 'c-right', x: 86, y: 37, size: 26, fill: '#E8B000', fg: INK, text: '▶︎' },
      { button: 'c-down', x: 62, y: 61, size: 26, fill: '#E8B000', fg: INK, text: '▼︎' },
      { button: 'b', x: 16, y: 62, size: 28, fill: '#1E8F4E', fg: WHITE },
      { button: 'a', x: 46, y: 86, size: 32, fill: '#2456C8', fg: WHITE }
    ],
    shouldersLeft: ['l'],
    shouldersRight: ['r'],
    shoulderCenter: ['z'],
    menuLeft: [],
    menuRight: ['start'],
    pad: 'n64'
  },
  sms: {
    faces: diagonal('1', '2', ACCENT, INK),
    shouldersLeft: [],
    shouldersRight: [],
    shoulderCenter: [],
    menuLeft: [],
    menuRight: ['start'],
    pad: 'dpad'
  },
  gamegear: {
    faces: diagonal('1', '2', ACCENT, INK),
    shouldersLeft: [],
    shouldersRight: [],
    shoulderCenter: [],
    menuLeft: [],
    menuRight: ['start'],
    pad: 'dpad'
  },
  megadrive: {
    faces: [
      { button: 'a', x: 18, y: 66, size: 32, fill: ACCENT, fg: INK },
      { button: 'b', x: 50, y: 50, size: 32, fill: ACCENT, fg: INK },
      { button: 'c', x: 82, y: 34, size: 32, fill: ACCENT, fg: INK }
    ],
    shouldersLeft: [],
    shouldersRight: [],
    shoulderCenter: [],
    menuLeft: [],
    menuRight: ['start'],
    pad: 'dpad'
  },
  ps: {
    faces: [
      { button: PS.top, x: 50, y: 18, size: 32, fill: '#2B2B30', fg: '#3DDC97', text: '△' },
      { button: PS.left, x: 18, y: 50, size: 32, fill: '#2B2B30', fg: '#F49AC2', text: '□' },
      { button: PS.right, x: 82, y: 50, size: 32, fill: '#2B2B30', fg: '#FF6B6B', text: '○' },
      { button: PS.bottom, x: 50, y: 82, size: 32, fill: '#2B2B30', fg: '#7FB2FF', text: '✕' }
    ],
    shouldersLeft: ['l1', 'l2'],
    shouldersRight: ['r1', 'r2'],
    shoulderCenter: [],
    menuLeft: ['select'],
    menuRight: ['start'],
    pad: 'dpad'
  },
  arcade: {
    faces: [
      { button: 'c', x: 28, y: 28, size: 40, fill: '#FFD23F', fg: INK },
      { button: 'd', x: 72, y: 28, size: 40, fill: '#7CFC00', fg: INK },
      { button: 'a', x: 28, y: 72, size: 40, fill: '#FF3EA5', fg: INK },
      { button: 'b', x: 72, y: 72, size: 40, fill: '#22D3EE', fg: INK }
    ],
    shouldersLeft: [],
    shouldersRight: [],
    shoulderCenter: [],
    menuLeft: ['coin'],
    menuRight: ['start'],
    pad: 'stick'
  },
  neogeo: {
    box: 'wide',
    faces: [
      { button: 'a', x: 14, y: 66, size: 26, fill: '#E5322D', fg: WHITE },
      { button: 'b', x: 38, y: 50, size: 26, fill: '#F2C14E', fg: INK },
      { button: 'c', x: 62, y: 40, size: 26, fill: '#2FA84F', fg: WHITE },
      { button: 'd', x: 86, y: 34, size: 26, fill: '#2D6CDF', fg: WHITE }
    ],
    shouldersLeft: [],
    shouldersRight: [],
    shoulderCenter: [],
    menuLeft: ['coin'],
    menuRight: ['start'],
    pad: 'stick'
  }
};

const DPAD_BUTTONS = ['up', 'down', 'left', 'right'] as const;
const STICK_BUTTONS = ['stick-up', 'stick-down', 'stick-left', 'stick-right'] as const;
const DIRECTION_CLASS = ['vc-dir-up', 'vc-dir-down', 'vc-dir-left', 'vc-dir-right'] as const;
const TAP_MS = 100;

function vibrate() {
  try {
    navigator.vibrate?.(8);
  } catch {
    // Vibration is optional.
  }
}

type PressApi = {
  active: () => boolean;
  press: (button: ConsoleButton) => void;
  release: (button: ConsoleButton) => void;
  tap: (button: ConsoleButton) => void;
};

function PadButton({
  consoleId,
  button,
  pressed,
  inert,
  api,
  className,
  style,
  children
}: {
  consoleId: BezelConsoleId;
  button: ConsoleButton;
  pressed: boolean;
  inert: boolean;
  api: PressApi;
  className: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!api.active()) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers have no capture.
    }
    api.press(button);
  };
  const onRelease = () => api.release(button);
  // A click with detail 0 comes from a keyboard or a screen reader: press and release.
  const onClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) api.tap(button);
  };
  return (
    <button
      type="button"
      data-button={button}
      data-pressed={pressed || undefined}
      aria-label={buttonLabel(consoleId, button)}
      aria-disabled={inert || undefined}
      className={className}
      style={style}
      onPointerDown={onPointerDown}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onLostPointerCapture={onRelease}
      onClick={onClick}
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </button>
  );
}

// Eight-way pad: one pointer drives the four directions; sliding changes the direction.
function DirectionPad({
  consoleId,
  buttons,
  variant,
  pressed,
  inert,
  api
}: {
  consoleId: BezelConsoleId;
  buttons: readonly ConsoleButton[];
  variant: 'dpad' | 'stick';
  pressed: ReadonlySet<ConsoleButton>;
  inert: boolean;
  api: PressApi;
}) {
  const pointerRef = useRef<number | null>(null);
  const [up, down, left, right] = buttons;

  const apply = (next: ReadonlySet<ConsoleButton>) => {
    for (const button of buttons) {
      if (next.has(button)) api.press(button);
      else api.release(button);
    }
  };

  const directionsAt = (event: ReactPointerEvent<HTMLDivElement>): Set<ConsoleButton> => {
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const next = new Set<ConsoleButton>();
    if (Math.hypot(dx, dy) < 0.2) return next;
    const sector = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) / 45) % 8;
    if (sector === 7 || sector === 0 || sector === 1) next.add(right);
    if (sector >= 1 && sector <= 3) next.add(down);
    if (sector >= 3 && sector <= 5) next.add(left);
    if (sector >= 5 && sector <= 7) next.add(up);
    return next;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!api.active() || pointerRef.current !== null) return;
    event.preventDefault();
    pointerRef.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers have no capture.
    }
    apply(directionsAt(event));
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== event.pointerId || !api.active()) return;
    apply(directionsAt(event));
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    pointerRef.current = null;
    apply(new Set());
  };

  const kx = (pressed.has(right) ? 1 : 0) - (pressed.has(left) ? 1 : 0);
  const ky = (pressed.has(down) ? 1 : 0) - (pressed.has(up) ? 1 : 0);

  return (
    <div
      className={`vc-pad vc-pad-${variant}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onContextMenu={(event) => event.preventDefault()}
    >
      {variant === 'stick' ? (
        <span aria-hidden="true" className="vc-knob" style={{ '--kx': kx, '--ky': ky } as CSSProperties} />
      ) : (
        <span aria-hidden="true" className="vc-hub" />
      )}
      {buttons.map((button, index) => (
        <button
          key={button}
          type="button"
          data-button={button}
          data-pressed={pressed.has(button) || undefined}
          aria-label={buttonLabel(consoleId, button)}
          aria-disabled={inert || undefined}
          className={`vc-dir ${DIRECTION_CLASS[index]}`}
          onClick={(event) => {
            if (event.detail === 0) api.tap(button);
          }}
        />
      ))}
    </div>
  );
}

export default function VirtualController({ consoleId, status, onInput }: VirtualControllerProps) {
  const layout = LAYOUTS[consoleId];
  const visible = status === 'booting' || status === 'running';
  const running = status === 'running';
  const [pressed, setPressed] = useState<ReadonlySet<ConsoleButton>>(() => new Set());
  const [n64Pad, setN64Pad] = useState<'stick' | 'dpad'>('stick');
  const pressedRef = useRef(new Set<ConsoleButton>());
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;
  const runningRef = useRef(running);
  runningRef.current = running;

  const press = useCallback((button: ConsoleButton) => {
    if (!runningRef.current || pressedRef.current.has(button)) return;
    pressedRef.current.add(button);
    onInputRef.current(button, true);
    vibrate();
    setPressed(new Set(pressedRef.current));
  }, []);

  const release = useCallback((button: ConsoleButton) => {
    if (!pressedRef.current.has(button)) return;
    pressedRef.current.delete(button);
    onInputRef.current(button, false);
    setPressed(new Set(pressedRef.current));
  }, []);

  const releaseAll = useCallback(() => {
    for (const button of Array.from(pressedRef.current)) release(button);
  }, [release]);

  const tap = useCallback(
    (button: ConsoleButton) => {
      if (!runningRef.current) return;
      press(button);
      window.setTimeout(() => release(button), TAP_MS);
    },
    [press, release]
  );

  const api: PressApi = { active: () => runningRef.current, press, release, tap };

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') releaseAll();
    };
    window.addEventListener('blur', releaseAll);
    window.addEventListener('orientationchange', releaseAll);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', releaseAll);
      window.removeEventListener('orientationchange', releaseAll);
      document.removeEventListener('visibilitychange', onVisibility);
      releaseAll();
    };
  }, [releaseAll]);

  useEffect(() => {
    if (!running) releaseAll();
  }, [running, releaseAll]);

  const inert = !running;
  const button = (name: ConsoleButton, className: string, children?: ReactNode, style?: CSSProperties) => (
    <PadButton
      key={name}
      consoleId={consoleId}
      button={name}
      pressed={pressed.has(name)}
      inert={inert}
      api={api}
      className={className}
      style={style}
    >
      {children}
    </PadButton>
  );

  const padButtons = layout.pad === 'n64' && n64Pad === 'stick' ? STICK_BUTTONS : DPAD_BUTTONS;
  const padVariant = layout.pad === 'stick' || (layout.pad === 'n64' && n64Pad === 'stick') ? 'stick' : 'dpad';

  return (
    <div
      role="group"
      aria-label="Game controller"
      className="vc"
      data-console={consoleId}
      data-state={visible ? (running ? 'active' : 'inert') : 'hidden'}
    >
      <div className="vc-sl">{layout.shouldersLeft.map((name) => button(name, 'vc-btn vc-shoulder', buttonLabel(consoleId, name)))}</div>
      <div className="vc-sc">{layout.shoulderCenter.map((name) => button(name, 'vc-btn vc-shoulder', buttonLabel(consoleId, name)))}</div>
      <div className="vc-sr">{layout.shouldersRight.map((name) => button(name, 'vc-btn vc-shoulder', buttonLabel(consoleId, name)))}</div>

      <div className="vc-left">
        <DirectionPad
          key={padVariant + padButtons[0]}
          consoleId={consoleId}
          buttons={padButtons}
          variant={padVariant}
          pressed={pressed}
          inert={inert}
          api={api}
        />
      </div>

      <div className="vc-right">
        <div className="vc-faces" data-box={layout.box}>
          {layout.faces.map((face) =>
            button(face.button, 'vc-btn vc-face', <span aria-hidden="true">{face.text ?? buttonLabel(consoleId, face.button)}</span>, {
              left: `${face.x}%`,
              top: `${face.y}%`,
              width: `${face.size}%`,
              '--fill': face.fill,
              '--fg': face.fg
            } as CSSProperties)
          )}
        </div>
      </div>

      <div className="vc-ml">
        {layout.pad === 'n64' ? (
          <button
            type="button"
            className="vc-menu"
            aria-label={n64Pad === 'stick' ? 'Use D-pad' : 'Use stick'}
            aria-disabled={inert || undefined}
            onClick={() => {
              releaseAll();
              setN64Pad((mode) => (mode === 'stick' ? 'dpad' : 'stick'));
            }}
          >
            <span aria-hidden="true" className="vc-menu-pill" />
            <span aria-hidden="true" className="vc-menu-label">
              {n64Pad === 'stick' ? 'D-pad' : 'Stick'}
            </span>
          </button>
        ) : null}
        {layout.menuLeft.map((name) =>
          button(
            name,
            'vc-btn vc-menu',
            <>
              <span aria-hidden="true" className="vc-menu-pill" />
              <span aria-hidden="true" className="vc-menu-label">
                {buttonLabel(consoleId, name)}
              </span>
            </>
          )
        )}
      </div>
      <div className="vc-mr">
        {layout.menuRight.map((name) =>
          button(
            name,
            'vc-btn vc-menu',
            <>
              <span aria-hidden="true" className="vc-menu-pill" />
              <span aria-hidden="true" className="vc-menu-label">
                {buttonLabel(consoleId, name)}
              </span>
            </>
          )
        )}
      </div>

      <div className="vc-grille" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
