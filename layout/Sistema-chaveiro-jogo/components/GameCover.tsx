'use client';

import { useState } from 'react';

type GameCoverProps = {
  src?: string | null;
  title: string;
  system: string;
  accent: string;
  bg: string;
  frameColor: string;
  eager?: boolean;
  className?: string;
};

// Game cover that fills its parent. Without a URL, or when the image fails to load, it draws a
// generated cover in the console colors: a pixel pattern, the title and the console name.
export default function GameCover({ src, title, system, accent, bg, frameColor, eager, className = '' }: GameCoverProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`} style={{ backgroundColor: bg, containerType: 'inline-size' }}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- capas externas (IGDB) sem next.config
        <img
          src={src as string}
          alt={`Capa de ${title}`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          role="img"
          aria-label={`Capa de ${title}`}
          className="flex h-full w-full flex-col justify-between p-[8%]"
          style={{
            backgroundImage: `radial-gradient(circle at 80% 15%, ${accent}55, transparent 55%), linear-gradient(160deg, ${frameColor}40, ${bg} 70%)`
          }}
        >
          <div aria-hidden="true" className="grid w-1/2 grid-cols-4 gap-[6%] opacity-90">
            {Array.from({ length: 12 }, (_, i) => (
              <span
                key={i}
                className="aspect-square rounded-[2px]"
                style={{ backgroundColor: (i * 7 + title.length) % 3 === 0 ? accent : 'transparent' }}
              />
            ))}
          </div>
          <div>
            <p className="font-display text-[clamp(0.9rem,9cqw,1.6rem)] font-bold uppercase leading-[1.05] text-white [overflow-wrap:anywhere]">
              {title}
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: accent }}>
              {system}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
