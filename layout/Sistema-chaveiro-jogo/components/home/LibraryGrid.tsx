'use client';

import { useMemo, useState } from 'react';
import GameTile from '@/components/home/GameTile';
import type { ShowcaseGame } from '@/lib/game-showcase';

const ALL = 'Todos';

// Catalog with console chips and a title search, filtered in the browser.
// `initialSystem` comes from ?console= so the console cards below can open a filtered view.
export default function LibraryGrid({ games, initialSystem }: { games: ShowcaseGame[]; initialSystem?: string }) {
  const systems = useMemo(() => {
    const counts = new Map<string, { accent: string; count: number }>();
    for (const game of games) {
      const entry = counts.get(game.system) ?? { accent: game.accent, count: 0 };
      entry.count += 1;
      counts.set(game.system, entry);
    }
    return Array.from(counts, ([system, entry]) => ({ system, ...entry })).sort((a, b) => b.count - a.count);
  }, [games]);

  const [system, setSystem] = useState(
    initialSystem && systems.some((item) => item.system === initialSystem) ? initialSystem : ALL
  );
  const [query, setQuery] = useState('');

  const visible = games.filter(
    (game) =>
      (system === ALL || game.system === system) &&
      game.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Filtrar por console" className="home-rail -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
          <Chip label={ALL} count={games.length} accent="#FFC24B" selected={system === ALL} onClick={() => setSystem(ALL)} />
          {systems.map((item) => (
            <Chip
              key={item.system}
              label={item.system}
              count={item.count}
              accent={item.accent}
              selected={system === item.system}
              onClick={() => setSystem(item.system)}
            />
          ))}
        </div>
        <label className="relative block w-full lg:w-72">
          <span className="sr-only">Buscar jogo</span>
          <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar jogo"
            className="min-h-11 w-full rounded-full bg-white/5 pl-11 pr-4 text-sm text-white ring-1 ring-white/10 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-brass"
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-white/10 p-10 text-center text-zinc-400">
          Nenhum jogo encontrado.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((game, i) => (
            <li key={`${system}-${query}-${game.slug}`} className="animate-rise" style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
              <GameTile game={game} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({
  label,
  count,
  accent,
  selected,
  onClick
}: {
  label: string;
  count: number;
  accent: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition duration-300 ${
        selected ? 'bg-white text-ink' : 'bg-white/5 text-zinc-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
      {label}
      <span className={`text-xs ${selected ? 'text-zinc-500' : 'text-zinc-500'}`}>{count}</span>
    </button>
  );
}
