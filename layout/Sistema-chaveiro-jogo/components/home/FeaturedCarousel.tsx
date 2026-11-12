'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import GameCover from '@/components/GameCover';
import { PlayIcon } from '@/components/home/GameTile';
import type { ShowcaseGame } from '@/lib/game-showcase';

const SLIDE_MS = 7000;

// Featured band: the active game's cover, blurred, fills the background and the console accent
// tints it. The progress bar under the active thumbnail advances the slide when its animation ends,
// so hovering or focusing the band pauses it. With reduced motion there is no autoplay.
export default function FeaturedCarousel({ games }: { games: ShowcaseGame[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [autoplay, setAutoplay] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setAutoplay(!query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (games.length === 0) return null;
  const active = games[index];
  const go = (next: number) => setIndex((next + games.length) % games.length);
  const meta = [active.year, ...active.genres].filter(Boolean);

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Jogos em destaque"
      className="relative isolate overflow-hidden rounded-[32px] ring-1 ring-white/10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {games.map((game, i) => (
          <div
            key={game.slug}
            className="absolute inset-0 transition-opacity duration-1000 ease-out"
            style={{ opacity: i === index ? 1 : 0, backgroundColor: game.bg }}
          >
            {game.cover ? (
              // eslint-disable-next-line @next/next/no-img-element -- capa externa como fundo desfocado
              <img src={game.cover} alt="" className="h-full w-full scale-125 object-cover opacity-60 blur-2xl saturate-150" />
            ) : null}
            <div
              className="absolute inset-0"
              style={{ backgroundImage: `radial-gradient(ellipse at 75% 30%, ${game.accent}55, transparent 60%)` }}
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent" />
        <div className="home-scanlines absolute inset-0 opacity-60" />
      </div>

      <div className="grid gap-10 px-6 pb-8 pt-10 sm:px-10 lg:grid-cols-[1fr_auto] lg:items-center lg:px-14 lg:pt-14">
        <div key={active.slug} className="max-w-xl animate-rise" aria-live={autoplay && !paused ? 'off' : 'polite'}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur">
              Em destaque
            </span>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: active.accent, boxShadow: `inset 0 0 0 1px ${active.accent}80` }}
            >
              {active.system}
            </span>
          </div>
          <h3 className="mt-5 font-display text-4xl font-bold leading-[1.02] text-white sm:text-5xl lg:text-6xl">{active.title}</h3>
          {meta.length > 0 ? <p className="mt-4 text-sm font-medium text-zinc-300">{meta.join('  ·  ')}</p> : null}
          {active.description ? (
            <p className="mt-4 line-clamp-3 text-base leading-relaxed text-zinc-300">{active.description}</p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/play/${encodeURIComponent(active.slug)}`}
              className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-brass px-7 font-bold text-ink shadow-[0_10px_40px_-10px_rgba(255,194,75,0.8)] transition hover:-translate-y-0.5 hover:bg-brass-300"
            >
              <PlayIcon className="h-3.5 w-3.5" /> Jogar agora
            </Link>
            <Link
              href="/connect"
              className="inline-flex min-h-12 items-center rounded-full bg-white/10 px-6 font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15"
            >
              Tenho o chaveiro · jogar no PC
            </Link>
          </div>
        </div>

        <div key={`cover-${active.slug}`} className="hidden animate-rise lg:block [perspective:1200px]">
          <div className="w-72 rotate-[-4deg] overflow-hidden rounded-3xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.95)] ring-1 ring-white/15 transition duration-700 [transform:rotateY(-12deg)] hover:[transform:rotateY(0deg)] xl:w-80">
            <div className="aspect-[3/4]">
              <GameCover
                src={active.cover}
                title={active.title}
                system={active.system}
                accent={active.accent}
                bg={active.bg}
                frameColor={active.frameColor}
                eager
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4 px-6 pb-8 sm:px-10 lg:px-14">
        <ul className="home-rail -m-2 flex gap-3 overflow-x-auto p-2">
          {games.map((game, i) => {
            const selected = i === index;
            return (
              <li key={game.slug} className="shrink-0">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Mostrar ${game.title}`}
                  aria-current={selected ? 'true' : undefined}
                  className={`relative block w-14 overflow-hidden rounded-xl transition duration-300 sm:w-16 ${
                    selected ? 'scale-105 ring-2 ring-white' : 'opacity-60 ring-1 ring-white/20 hover:opacity-100'
                  }`}
                >
                  <span className="block aspect-[3/4]">
                    <GameCover
                      src={game.cover}
                      title={game.title}
                      system={game.system}
                      accent={game.accent}
                      bg={game.bg}
                      frameColor={game.frameColor}
                    />
                  </span>
                  {selected ? (
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
                      <span
                        key={`${index}-${autoplay}`}
                        className={`block h-full origin-left bg-brass ${autoplay ? 'animate-[progress_7s_linear_forwards]' : ''}`}
                        style={{ animationPlayState: paused ? 'paused' : 'running', animationDuration: `${SLIDE_MS}ms` }}
                        onAnimationEnd={() => go(index + 1)}
                      />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <ArrowButton label="Jogo anterior" onClick={() => go(index - 1)} flip />
          <ArrowButton label="Próximo jogo" onClick={() => go(index + 1)} />
        </div>
      </div>
    </section>
  );
}

function ArrowButton({ label, onClick, flip }: { label: string; onClick: () => void; flip?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-4 w-4 ${flip ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
