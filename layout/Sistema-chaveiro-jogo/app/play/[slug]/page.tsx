"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Emulator from '@/components/Emulator';
import { getCoreForSystem } from '@/lib/emulator-cores';

interface Game {
  title: string;
  console?: string;
  system?: string;
}

export default function PlayPage({ params }: { params: { slug: string } }) {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGame = async () => {
      try {
        const response = await fetch(`/api/game/${params.slug}`);
        const data = await response.json();

        if (response.ok) {
          setGame(data);
        }
      } catch (error) {
        console.error('Unable to load game metadata', error);
      } finally {
        setLoading(false);
      }
    };

    loadGame();
  }, [params.slug]);

  const gameTitle = game?.title || params.slug;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Game launch</p>
        <h1 className="mt-4 text-3xl font-semibold">Playing: {gameTitle}</h1>
        {game && <p className="mt-2 text-zinc-400">{game.system || game.console}</p>}

        <div className="mt-8">
          {loading ? (
            <div className="flex h-96 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950">
              <p className="text-zinc-400">Loading game...</p>
            </div>
          ) : (
            (() => {
              const title = game?.title || params.slug;
              const core = getCoreForSystem(game?.system ?? game?.console ?? '');
              return <Emulator gameSlug={params.slug} gameTitle={title} core={core} />;
            })()
          )}
        </div>

        <div className="mt-6">
          <Link href="/" className="text-cyan-400 hover:text-cyan-300">
            ← Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
