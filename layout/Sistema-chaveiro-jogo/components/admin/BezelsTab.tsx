'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { getAdminAuthStatus, type AdminAuthStatus } from '@/lib/admin-api';
import { isBezelAspectOff, isBezelConsoleId, type BezelConsoleId } from '@/lib/bezel-console';
import { systemOptions } from '@/lib/emulator-cores';
import { DEFAULT_PLAY_THEMES } from '@/lib/play-theme';

interface BezelsTabProps {
  onAuthError: (status: AdminAuthStatus) => void;
}

type ConsoleOption = { value: BezelConsoleId; label: string };

type Preview = { kind: 'checking' } | { kind: 'empty' } | { kind: 'has-bezel'; url: string } | { kind: 'read-error' };

type SelectedFile = { file: File; url: string; width: number; height: number };

type Busy = 'idle' | 'uploading' | 'removing';

type Feedback = { tone: 'success' | 'error'; text: string };

// The 12 bezel consoles: label from systemOptions, value = the system's frame id (lib/bezel-console list).
const CONSOLE_OPTIONS: ConsoleOption[] = systemOptions.flatMap((option) => {
  const frame = DEFAULT_PLAY_THEMES[option.value].frame;
  return isBezelConsoleId(frame) ? [{ value: frame, label: option.label }] : [];
});

const NETWORK_ERROR = 'Could not reach the server.';
const STORAGE_FAILED = 'Storage failed. Nothing was saved. Try again.';
const STORAGE_MISSING = 'Storage is not configured. Nothing was saved.';

const UPLOAD_ERRORS: Record<number, string> = {
  400: 'Choose a PNG file first.',
  404: 'Unknown console.',
  413: 'File is over 2 MB.',
  415: 'This file is not a PNG.',
  502: STORAGE_FAILED,
  503: STORAGE_MISSING
};

const REMOVE_ERRORS: Record<number, string> = {
  404: 'This console has no bezel.',
  502: STORAGE_FAILED,
  503: STORAGE_MISSING
};

// Checkerboard behind the preview so transparent areas of the PNG stay visible (zinc-900 / zinc-800).
const CHECKER_STYLE = {
  backgroundColor: '#18181b',
  backgroundImage: 'repeating-conic-gradient(#27272a 0% 25%, transparent 0% 50%)',
  backgroundSize: '24px 24px'
};

const SECONDARY_BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-cyan-400 hover:text-cyan-400 disabled:cursor-not-allowed disabled:opacity-50';

export default function BezelsTab({ onAuthError }: BezelsTabProps) {
  const [consoleId, setConsoleId] = useState<BezelConsoleId>(CONSOLE_OPTIONS[0].value);
  const [preview, setPreview] = useState<Preview>({ kind: 'checking' });
  const [previewVersion, setPreviewVersion] = useState(0);
  const [file, setFile] = useState<SelectedFile | null>(null);
  const [busy, setBusy] = useState<Busy>('idle');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const consoleIdRef = useRef<BezelConsoleId>(consoleId);
  const previewUrlRef = useRef<string | null>(null);
  const fileUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const label = CONSOLE_OPTIONS.find((option) => option.value === consoleId)?.label ?? consoleId;
  const locked = busy !== 'idle';

  // Sets the current preview and revokes the object URL it replaces.
  function replacePreview(next: Preview) {
    const nextUrl = next.kind === 'has-bezel' ? next.url : null;
    if (previewUrlRef.current && previewUrlRef.current !== nextUrl) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = nextUrl;
    setPreview(next);
  }

  // Sets the selected file and revokes the object URL it replaces.
  function replaceFile(next: SelectedFile | null) {
    if (fileUrlRef.current && fileUrlRef.current !== next?.url) {
      URL.revokeObjectURL(fileUrlRef.current);
    }
    fileUrlRef.current = next?.url ?? null;
    setFile(next);
  }

  function clearFileInput() {
    replaceFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Reads the current bezel; a response for a console that is no longer selected is dropped (D16).
  useEffect(() => {
    const controller = new AbortController();
    const requestedId = consoleId;
    const isCurrent = () => !controller.signal.aborted && consoleIdRef.current === requestedId;
    replacePreview({ kind: 'checking' });

    (async () => {
      try {
        const response = await fetch(`/api/bezel/${requestedId}?v=${previewVersion}`, {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!isCurrent()) return;
        if (response.status === 200) {
          const blob = await response.blob();
          if (!isCurrent()) return;
          replacePreview({ kind: 'has-bezel', url: URL.createObjectURL(blob) });
        } else if (response.status === 404) {
          replacePreview({ kind: 'empty' });
        } else {
          replacePreview({ kind: 'read-error' });
        }
      } catch {
        if (isCurrent()) replacePreview({ kind: 'read-error' });
      }
    })();

    return () => controller.abort();
    // replacePreview only touches refs and state setters, so it is left out of the dependency list.
  }, [consoleId, previewVersion]);

  // Revokes every object URL still held when the tab unmounts.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
      previewUrlRef.current = null;
      fileUrlRef.current = null;
    };
  }, []);

  function handleConsoleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (!isBezelConsoleId(next)) return;
    consoleIdRef.current = next;
    setConsoleId(next);
    setFeedback(null);
    clearFileInput();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    setFeedback(null);
    if (!picked) {
      replaceFile(null);
      return;
    }
    const url = URL.createObjectURL(picked);
    replaceFile({ file: picked, url, width: 0, height: 0 });
    const image = new Image();
    image.onload = () => {
      if (fileUrlRef.current !== url) return;
      setFile((current) =>
        current && current.url === url ? { ...current, width: image.naturalWidth, height: image.naturalHeight } : current
      );
    };
    image.src = url;
  }

  async function handleUpload() {
    if (!file || locked) return;
    const uploadLabel = label;
    setBusy('uploading');
    setFeedback(null);
    try {
      const body = new FormData();
      body.append('file', file.file);
      const response = await fetch(`/api/admin/bezels/${consoleId}`, { method: 'POST', body });
      const authStatus = getAdminAuthStatus(response);
      if (authStatus) {
        onAuthError(authStatus);
        return;
      }
      if (response.status === 201) {
        setFeedback({ tone: 'success', text: `Bezel saved for ${uploadLabel}.` });
        clearFileInput();
        setPreviewVersion(Date.now());
      } else {
        setFeedback({ tone: 'error', text: UPLOAD_ERRORS[response.status] ?? 'Upload failed. Try again.' });
      }
    } catch {
      setFeedback({ tone: 'error', text: NETWORK_ERROR });
    } finally {
      setBusy('idle');
    }
  }

  async function handleRemove() {
    if (preview.kind !== 'has-bezel' || locked) return;
    const removeLabel = label;
    if (!confirm(`Remove the bezel for ${removeLabel}?`)) return;
    setBusy('removing');
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/bezels/${consoleId}`, { method: 'DELETE' });
      const authStatus = getAdminAuthStatus(response);
      if (authStatus) {
        onAuthError(authStatus);
        return;
      }
      if (response.status === 204) {
        replacePreview({ kind: 'empty' });
        setFeedback({ tone: 'success', text: `Bezel removed for ${removeLabel}.` });
      } else {
        setFeedback({ tone: 'error', text: REMOVE_ERRORS[response.status] ?? 'Remove failed. Try again.' });
      }
    } catch {
      setFeedback({ tone: 'error', text: NETWORK_ERROR });
    } finally {
      setBusy('idle');
    }
  }

  const aspectOff = file !== null && file.width > 0 && file.height > 0 && isBezelAspectOff(file.width, file.height);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <h2 className="text-xl font-semibold">Bezel por console</h2>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="bezel-console" className="text-sm text-zinc-300">
            Console
          </label>
          <select
            id="bezel-console"
            value={consoleId}
            onChange={handleConsoleChange}
            disabled={locked}
            className="min-h-11 max-w-xs rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base text-zinc-100 disabled:opacity-50"
          >
            {CONSOLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-300">Current bezel</p>
          {preview.kind === 'checking' ? (
            <div aria-hidden="true" className="aspect-video w-full max-w-xl rounded-lg bg-zinc-800 motion-safe:animate-pulse" />
          ) : preview.kind === 'has-bezel' ? (
            <div className="aspect-video w-full max-w-xl overflow-hidden rounded-lg" style={CHECKER_STYLE}>
              <img src={preview.url} alt={`Current bezel for ${label}`} className="h-full w-full object-fill" />
            </div>
          ) : (
            <div className="flex aspect-video w-full max-w-xl flex-col items-center justify-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
              {preview.kind === 'empty' ? (
                <p className="text-sm text-zinc-400">No bezel for this console yet.</p>
              ) : (
                <>
                  <p className="text-sm text-zinc-300">Could not read this bezel.</p>
                  <button
                    type="button"
                    onClick={() => setPreviewVersion(Date.now())}
                    disabled={locked}
                    className={SECONDARY_BUTTON}
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          )}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleRemove}
              disabled={locked || preview.kind !== 'has-bezel'}
              className="inline-flex min-h-11 items-center px-2 text-sm text-red-400 transition hover:text-red-300 disabled:cursor-not-allowed disabled:text-zinc-500"
            >
              Remove bezel
            </button>
            {/* The button keeps its "Remove" name while the DELETE runs; the progress text sits beside it. */}
            {busy === 'removing' ? <p className="text-sm text-zinc-400">Removing...</p> : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label
            className={`inline-flex min-h-11 w-fit items-center rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400 ${
              locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-cyan-400 hover:text-cyan-400'
            }`}
          >
            Choose PNG
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              onChange={handleFileChange}
              disabled={locked}
              className="sr-only"
            />
          </label>
          {file ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-zinc-300">New file</p>
              <div className="aspect-video w-full max-w-xl overflow-hidden rounded-lg" style={CHECKER_STYLE}>
                <img src={file.url} alt={`Selected file ${file.file.name}`} className="h-full w-full object-fill" />
              </div>
            </div>
          ) : null}
          {aspectOff && file ? (
            <p role="status" className="text-sm text-amber-300">
              {`This image is ${file.width}×${file.height}, not 16:9. It will be stretched to 16:9 on the play screen. You can still upload.`}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleUpload}
            disabled={locked || !file}
            className="min-h-11 w-fit rounded bg-cyan-500 px-6 py-2 font-medium text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'uploading' ? 'Uploading...' : 'Upload bezel'}
          </button>
          {feedback?.tone === 'success' ? (
            <p role="status" className="text-sm text-cyan-400">
              {feedback.text}
            </p>
          ) : null}
          {feedback?.tone === 'error' ? (
            <p role="alert" className="text-sm text-red-400">
              {feedback.text}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
