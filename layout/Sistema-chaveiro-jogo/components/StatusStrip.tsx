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

// Phone: an 8-unit strip laid over the bottom of the stage, so it never moves the game window;
// its text is visually hidden while running. Wide: one fixed-height row in the page flow.
// The role=status node stays mounted in every state.
export default function StatusStrip({ state, attempt, total, coreName }: StatusStripProps) {
  const running = state === 'running';
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 flex h-8 items-center justify-center px-4 wide:static wide:shrink-0 wide:bg-transparent ${
        running ? 'bg-transparent' : 'bg-[color:var(--t-bg)]'
      }`}
    >
      <p
        role="status"
        className={
          running
            ? 'sr-only truncate text-xs text-[color:var(--t-muted)] wide:not-sr-only'
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
