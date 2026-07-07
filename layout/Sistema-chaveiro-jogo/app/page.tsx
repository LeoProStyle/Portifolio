import Link from 'next/link';
import RoomsSection from '@/components/RoomsSection';

const games = [
  { title: 'Super Retro', slug: 'super-retro', description: 'A classic arcade experience.' },
  { title: 'Pixel Quest', slug: 'pixel-quest', description: 'A retro platformer for the modern browser.' }
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
      <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl shadow-black/30">
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-cyan-400">RetroKey MVP</p>
        <h1 className="text-4xl font-semibold sm:text-6xl">Tap a cartridge, launch a game.</h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-300">
          This starter structure reflects the PRD for a browser-first retro gaming platform powered by NFC.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/nfc/demo" className="rounded-full bg-cyan-500 px-5 py-3 font-medium text-zinc-950 transition hover:bg-cyan-400">
            Simulate NFC launch
          </Link>
          <Link href="/admin" className="rounded-full border border-zinc-700 px-5 py-3 font-medium text-zinc-100 transition hover:border-cyan-500">
            Open admin area
          </Link>
        </div>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-2">
        {games.map((game) => (
          <article key={game.slug} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
            <h2 className="text-xl font-semibold">{game.title}</h2>
            <p className="mt-2 text-zinc-400">{game.description}</p>
            <Link href={`/play/${game.slug}`} className="mt-4 inline-block text-cyan-400 hover:text-cyan-300">
              Open game →
            </Link>
          </article>
        ))}
      </section>

      <RoomsSection />
    </main>
  );
}
