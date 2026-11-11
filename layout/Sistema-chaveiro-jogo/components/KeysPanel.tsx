'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { BezelConsoleId } from '@/lib/bezel-console';
import {
  BUTTONS_BY_CONSOLE,
  buttonLabel,
  isKeyCode,
  keyCapLabel,
  type ConsoleButton,
  type ControlMap,
  type KeyCode
} from '@/lib/emulator-controls';

interface KeysPanelProps {
  consoleId: BezelConsoleId;
  map: ControlMap;
  hasSaved: boolean;
  storageOk: boolean;
  open: boolean;
  onRemap: (button: ConsoleButton, code: KeyCode) => void;
  onReset: () => void;
  onClose: () => void;
}

const ACTION_CLASS =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-[color:var(--t-accent)] px-6 text-sm font-semibold text-[#18181B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-text)]';

const CONSOLE_NAMES: Record<BezelConsoleId, string> = {
  nes: 'NES',
  snes: 'SNES',
  n64: 'Nintendo 64',
  dmg: 'Game Boy',
  gbc: 'Game Boy Color',
  gba: 'Game Boy Advance',
  sms: 'Master System',
  megadrive: 'Mega Drive',
  gamegear: 'Game Gear',
  ps: 'PlayStation',
  arcade: 'Arcade',
  neogeo: 'Neo Geo'
};

// Keys remap dialog (0002F SF02 design.md "Painel Keys"). Each accepted key is saved at once.
export default function KeysPanel({ consoleId, map, hasSaved, storageOk, open, onRemap, onReset, onClose }: KeysPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [capture, setCapture] = useState<ConsoleButton | null>(null);
  const [status, setStatus] = useState('');
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setCapture(null);
      setStatus('');
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!storageOk) setStatus("Keys can't be saved in this browser.");
  }, [storageOk]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (!capture) return;
    // Escape goes on to the dialog `cancel` event, which ends the capture.
    if (event.code === 'Escape' || event.key === 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    const code = event.code;
    if (!isKeyCode(code)) {
      setStatus("That key can't be used. Pick another.");
      return;
    }
    const holder = BUTTONS_BY_CONSOLE[consoleId].find((other) => other !== capture && map[other] === code);
    onRemap(capture, code);
    setCapture(null);
    if (!storageOk) setStatus("Keys can't be saved in this browser.");
    else if (holder) setStatus(`${keyCapLabel(code)} was on ${buttonLabel(consoleId, holder)}; swapped.`);
    else setStatus('Saved.');
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        if (capture) {
          setCapture(null);
          setStatus('');
        } else {
          onClose();
        }
      }}
      onClose={() => {
        if (open) onClose();
      }}
      className="max-h-[80vh] w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-[var(--t-radius)] border border-[color:var(--t-frame)] bg-[color:var(--t-bg)] p-0 text-[color:var(--t-text)] backdrop:bg-black/60"
    >
      <div className="flex max-h-[80vh] flex-col p-6">
        <div className="mb-4 shrink-0">
          <h2 id={titleId} className="text-lg font-semibold">
            Keys
          </h2>
          <p className="text-sm text-[color:var(--t-muted)]">{CONSOLE_NAMES[consoleId]}</p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {BUTTONS_BY_CONSOLE[consoleId].map((button) => {
            const code = map[button];
            const capturing = capture === button;
            return (
              <li key={button} className="flex min-h-11 items-center justify-between gap-3 text-sm">
                <span>{buttonLabel(consoleId, button)}</span>
                <button
                  type="button"
                  data-key-row={button}
                  aria-label={`${buttonLabel(consoleId, button)}: ${code ? keyCapLabel(code) : 'none'}. Change key`}
                  onClick={() => {
                    setCapture(button);
                    setStatus(`Press a key for ${buttonLabel(consoleId, button)}. Esc cancels.`);
                  }}
                  className={`inline-flex min-h-11 min-w-16 items-center justify-center rounded-md border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-accent)] ${
                    capturing
                      ? 'border-[color:var(--t-accent)] bg-[color:var(--t-accent)] text-[#18181B]'
                      : 'border-[color:var(--t-muted)] text-[color:var(--t-text)]'
                  }`}
                >
                  {capturing ? '…' : code ? keyCapLabel(code) : '—'}
                </button>
              </li>
            );
          })}
        </ul>
        <p role="status" className="mt-3 min-h-5 shrink-0 text-sm text-[color:var(--t-text)]">
          {status}
        </p>
        <footer className="mt-4 flex shrink-0 items-center justify-end gap-3">
          <button
            type="button"
            disabled={!hasSaved}
            onClick={() => {
              onReset();
              setCapture(null);
              setStatus('Default keys restored.');
            }}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[color:var(--t-muted)] px-5 text-sm text-[color:var(--t-text)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-accent)]"
          >
            Reset to default
          </button>
          <button type="button" onClick={onClose} className={ACTION_CLASS}>
            Done
          </button>
        </footer>
      </div>
    </dialog>
  );
}
