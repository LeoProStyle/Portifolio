import Link from 'next/link';
import type { CSSProperties } from 'react';
import GameCover from '@/components/GameCover';
import type { ShowcaseGame } from '@/lib/game-showcase';

type GameTileProps = {
  game: ShowcaseGame;
  style?: CSSProperties;
  className?: string;
};

// Library card: the whole tile opens the game. On hover or focus it lifts and glows in the console accent.
export default function GameTile({ game, style, className = '' }: GameTileProps) {
  const meta = [game.year, game.genres[0]].filter(Boolean).join(' · ');
  return (
    <Link
      href={`/play/${encodeURIComponent(game.slug)}`}
      className={`group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-4 focus-visible:ring-offset-ink ${className}`}
      style={{ ...style, ['--accent' as string]: game.accent }}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-white/10 transition duration-500 ease-out group-hover:-translate-y-1.5 group-hover:shadow-[0_24px_60px_-18px_var(--accent)] group-hover:ring-[color:var(--accent)] group-focus-visible:-translate-y-1.5">
        <div className="h-full w-full transition duration-700 ease-out group-hover:scale-[1.06]">
          <GameCover
            src={game.cover}
            title={game.title}
            system={game.system}
            accent={game.accent}
            bg={game.bg}
            frameColor={game.frameColor}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent opacity-0 transition duration-500 group-hover:opacity-100 group-focus-visible:opacity-100" />
        <span className="absolute bottom-3 left-3 inline-flex translate-y-3 items-center gap-2 rounded-full bg-brass px-3.5 py-1.5 text-xs font-bold text-ink opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
          <PlayIcon /> Jogar
        </span>
        <span
          className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white backdrop-blur"
          style={{ boxShadow: `inset 0 0 0 1px ${game.accent}66` }}
        >
          {game.system}
        </span>
      </div>
      <p className="mt-3 truncate font-display text-base font-semibold text-white">{game.title}</p>
      <p className="mt-0.5 h-5 truncate text-sm text-zinc-400">{meta}</p>
    </Link>
  );
}

export function PlayIcon({ className = 'h-3 w-3' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className={className} fill="currentColor">
      <path d="M2.5 1.2v9.6c0 .5.5.8.9.5l7.4-4.8c.4-.3.4-.8 0-1.1L3.4.7c-.4-.3-.9 0-.9.5z" />
    </svg>
  );
}
