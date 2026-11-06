'use client';

// Play screen states (design.md 0002F SF01, Screens → state table).
export type PlayScreenState = 'loading-metadata' | 'not-found' | 'metadata-error' | 'booting' | 'running' | 'failed';

interface StatusStripProps {
  state: PlayScreenState;
  attempt?: number;
  total?: number;
  coreName?: string;
}

const LABELS: Record<PlayScreenState, string> = {
  'loading-metadata': 'Loading game...',
  'not-found': 'Not found',
  'metadata-error': 'Error',
  booting: 'Starting game...',
  running: 'Running',
  failed: 'Failed'
};

function labelFor(state: PlayScreenState, attempt?: number, total?: number) {
  if (state === 'booting' && attempt && total) {
    return `Starting game (attempt ${attempt} of ${total})...`;
  }
  return LABELS[state];
}

// One fixed-height row, so a state change never moves the frame.
export default function StatusStrip({ state, attempt, total, coreName }: StatusStripProps) {
  const running = state === 'running';
  return (
    <div className="flex h-8 shrink-0 items-center justify-center px-4">
      <p
        role="status"
        className={
          running
            ? 'truncate text-xs text-[color:var(--t-muted)]'
            : 'truncate text-sm text-[color:var(--t-text)]'
        }
      >
        {labelFor(state, attempt, total)}
        {coreName && (state === 'booting' || state === 'running') ? (
          <span className="sr-only"> (core {coreName})</span>
        ) : null}
      </p>
    </div>
  );
}
