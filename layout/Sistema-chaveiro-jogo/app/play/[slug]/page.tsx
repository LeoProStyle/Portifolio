"use client";

import { useCallback, useEffect, useState } from 'react';
import PlayStage, { type MetaState, type PlayGameMeta } from '@/components/PlayStage';

export default function PlayPage({ params }: { params: { slug: string } }) {
  const [game, setGame] = useState<PlayGameMeta | null>(null);
  const [metaState, setMetaState] = useState<MetaState>('loading');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let ignore = false;

    const loadGame = async () => {
      setGame(null);
      setMetaState('loading');
      try {
        const response = await fetch(`/api/game/${encodeURIComponent(params.slug)}`);
        if (ignore) return;

        if (response.status === 404) {
          setGame(null);
          setMetaState('not-found');
          return;
        }
        if (!response.ok) {
          setGame(null);
          setMetaState('metadata-error');
          return;
        }

        const data = (await response.json()) as PlayGameMeta;
        if (ignore) return;
        setGame(data);
        setMetaState('ok');
      } catch (error) {
        if (ignore) return;
        console.error('Unable to load game metadata', error);
        setGame(null);
        setMetaState('metadata-error');
      }
    };

    loadGame();
    return () => {
      ignore = true;
    };
  }, [params.slug, retryCount]);

  const handleRetry = useCallback(() => setRetryCount((count) => count + 1), []);

  return (
    <main>
      <PlayStage key={params.slug} slug={params.slug} game={game} metaState={metaState} onRetry={handleRetry} />
    </main>
  );
}
