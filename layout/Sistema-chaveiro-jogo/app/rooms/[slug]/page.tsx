import Link from 'next/link';
import { getRoomBySlug } from '@/lib/data';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const room = await getRoomBySlug(params.slug);

  return {
    title: room ? `${room.title} | RetroKey` : 'Room not found | RetroKey'
  };
}

export default async function RoomPage({ params }: { params: { slug: string } }) {
  const room = await getRoomBySlug(params.slug);

  if (!room) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Room unavailable</p>
          <h1 className="mt-4 text-3xl font-semibold">This room does not exist.</h1>
          <Link href="/" className="mt-6 inline-block text-cyan-400 hover:text-cyan-300">
            ← Back home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-16">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">RetroKey room</p>
        <h1 className="mt-4 text-3xl font-semibold">{room.title}</h1>
        <p className="mt-4 text-zinc-300">{room.description}</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Details</p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-400">
              <li>Host: {room.host}</li>
              <li>Theme: {room.theme}</li>
              <li>Capacity: {room.capacity}</li>
              <li>Status: {room.status}</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Game</p>
            <p className="mt-4 text-lg font-semibold">{room.gameSlug}</p>
            <Link href={`/play/${room.gameSlug}`} className="mt-5 inline-block text-cyan-400 hover:text-cyan-300">
              Launch game →
            </Link>
          </div>
        </div>

        <Link href="/" className="mt-8 inline-block text-cyan-400 hover:text-cyan-300">
          ← Back home
        </Link>
      </div>
    </main>
  );
}
