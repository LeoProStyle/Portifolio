import GameCover from '@/components/GameCover';
import type { ShowcaseGame } from '@/lib/game-showcase';

type KeyCartridgeProps = {
  game: ShowcaseGame;
  className?: string;
  eager?: boolean;
  swingDelay?: string;
};

// The RetroKey signature: a cartridge-shaped keychain with a brass ring, the cover in the label
// window and the console name on the bottom strip. It swings from the ring.
export default function KeyCartridge({ game, className = '', eager, swingDelay = '0s' }: KeyCartridgeProps) {
  return (
    <div className={`origin-top animate-swing ${className}`} style={{ animationDelay: swingDelay }}>
      <div aria-hidden="true" className="mx-auto flex flex-col items-center">
        <span className="h-10 w-10 rounded-full border-[5px] border-brass shadow-[0_0_0_2px_rgba(0,0,0,0.35),inset_0_0_0_2px_rgba(255,255,255,0.25)]" />
        <span className="-mt-1 h-5 w-3 rounded-b-md bg-gradient-to-b from-brass-300 to-brass-600" />
      </div>
      <div
        className="relative -mt-1 rounded-[26px] p-2.5 pb-3 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
        style={{ backgroundImage: `linear-gradient(165deg, ${game.frameColor}, ${game.bg})` }}
      >
        <div aria-hidden="true" className="mb-2 flex justify-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-1 w-6 rounded-full bg-black/25" />
          ))}
        </div>
        <div className="aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-black/40">
          <GameCover
            src={game.cover}
            title={game.title}
            system={game.system}
            accent={game.accent}
            bg={game.bg}
            frameColor={game.frameColor}
            eager={eager}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between px-1.5">
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">{game.system}</span>
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inset-0 animate-pulsering rounded-full" style={{ backgroundColor: game.accent }} />
            <span className="relative h-2.5 w-2.5 rounded-full" style={{ backgroundColor: game.accent }} />
          </span>
        </div>
      </div>
    </div>
  );
}
