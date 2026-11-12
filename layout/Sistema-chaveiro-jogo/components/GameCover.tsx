'use client';

import { useState } from 'react';

type GameCoverProps = {
  src?: string;
  title: string;
  accent: string;
};

// Miniatura da capa no catálogo. Sem URL, ou se a imagem falhar ao carregar,
// mostra um bloco com a inicial do título no mesmo tamanho.
export default function GameCover({ src, title, accent }: GameCoverProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div className="aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- capas externas (IGDB) sem next.config
        <img
          src={src}
          alt={`Capa de ${title}`}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center rounded-lg border-2 text-2xl font-semibold text-zinc-500"
          style={{ borderColor: accent }}
        >
          {title.trim().charAt(0).toUpperCase() || '?'}
        </div>
      )}
    </div>
  );
}
