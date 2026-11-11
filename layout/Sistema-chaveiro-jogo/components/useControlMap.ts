import { useCallback, useEffect, useRef, useState } from 'react';
import type { BezelConsoleId } from '@/lib/bezel-console';
import {
  DEFAULT_CONTROL_MAPS,
  applyRemap,
  controlsStorageKey,
  parseSavedControlMap,
  resolveControlMap,
  serializeControlMap,
  type ConsoleButton,
  type ControlMap,
  type KeyCode
} from '@/lib/emulator-controls';

export type ControlMapState = {
  map: ControlMap | null;
  hasSaved: boolean;
  storageOk: boolean;
  remap: (button: ConsoleButton, code: KeyCode) => void;
  reset: () => void;
};

// Resolved key map of one console: player map in localStorage > console default (0002F SF02, RN04).
// The first render uses the default so server and client markup match.
export default function useControlMap(consoleId: BezelConsoleId | null): ControlMapState {
  const [map, setMap] = useState<ControlMap | null>(consoleId ? DEFAULT_CONTROL_MAPS[consoleId] : null);
  const [hasSaved, setHasSaved] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!consoleId) {
      setMap(null);
      setHasSaved(false);
      return;
    }
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(controlsStorageKey(consoleId));
    } catch {
      setStorageOk(false);
    }
    const saved = parseSavedControlMap(raw, consoleId);
    const resolved = resolveControlMap(saved ?? undefined, undefined, consoleId);
    setMap(resolved.map);
    setHasSaved(resolved.source === 'player');
  }, [consoleId]);

  const remap = useCallback(
    (button: ConsoleButton, code: KeyCode) => {
      if (!consoleId || !mapRef.current) return;
      const next = applyRemap(mapRef.current, consoleId, button, code).map;
      mapRef.current = next;
      setMap(next);
      try {
        window.localStorage.setItem(controlsStorageKey(consoleId), serializeControlMap(next));
        setHasSaved(true);
        setStorageOk(true);
      } catch {
        setStorageOk(false);
      }
    },
    [consoleId]
  );

  const reset = useCallback(() => {
    if (!consoleId) return;
    try {
      window.localStorage.removeItem(controlsStorageKey(consoleId));
    } catch {
      setStorageOk(false);
    }
    setMap(resolveControlMap(undefined, undefined, consoleId).map);
    setHasSaved(false);
  }, [consoleId]);

  return { map, hasSaved, storageOk, remap, reset };
}
