'use client';

import type { RefObject } from 'react';
import type { BezelConsoleId } from '@/lib/bezel-console';
import { keyCapLabel, legendGroups, type ControlMap } from '@/lib/emulator-controls';
import type { PlayScreenState } from '@/components/StatusStrip';

interface ControlsLegendProps {
  consoleId: BezelConsoleId | null;
  map: ControlMap | null;
  status: PlayScreenState;
  onEdit: () => void;
  editButtonRef: RefObject<HTMLButtonElement>;
}

// Wide key legend (0002F SF02 design.md "Linha da legenda"): one chip per button, direction sets in one chip.
export default function ControlsLegend({ consoleId, map, status, onEdit, editButtonRef }: ControlsLegendProps) {
  const active = status === 'booting' || status === 'running';
  if (!consoleId || !map || !active) return null;
  const booting = status === 'booting';

  return (
    <div className="flex h-10 items-center gap-3 px-4">
      <ul aria-label="Keyboard keys" className="flex min-w-0 flex-1 items-center gap-x-3 overflow-hidden">
        {legendGroups(consoleId).map((group) => {
          const keys = group.buttons.map((button) => map[button]).filter((code) => code !== undefined);
          return (
            <li key={group.label} className="inline-flex shrink-0 items-center gap-1 text-xs text-[color:var(--t-text)]">
              <span>{group.label}</span>
              <kbd className="rounded border border-[color:var(--t-muted)] px-1 font-sans text-xs text-[color:var(--t-text)]">
                {keys.map((code) => keyCapLabel(code)).join(' ')}
              </kbd>
            </li>
          );
        })}
      </ul>
      <button
        ref={editButtonRef}
        type="button"
        aria-disabled={booting || undefined}
        onClick={() => {
          if (!booting) onEdit();
        }}
        className="inline-flex h-10 min-w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--t-muted)] px-4 text-sm text-[color:var(--t-text)] aria-disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--t-accent)]"
      >
        Edit keys
      </button>
    </div>
  );
}
