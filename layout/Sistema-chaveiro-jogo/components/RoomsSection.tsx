'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Room } from '@/models/game';

export default function RoomsSection() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRooms() {
      try {
        const response = await fetch('/api/rooms');
        if (response.ok) {
          setRooms(await response.json());
        }
      } catch (error) {
        console.error('Failed to load rooms', error);
      } finally {
        setLoading(false);
      }
    }

    loadRooms();
  }, []);

  return (
    <section className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Live rooms</p>
          <h2 className="mt-2 text-2xl font-semibold">Join a RetroKey room</h2>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-zinc-400">Loading rooms...</p>
      ) : rooms.length === 0 ? (
        <p className="mt-6 text-zinc-400">No rooms available yet.</p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {rooms.map((room) => (
            <article key={room.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{room.title}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{room.description}</p>
                </div>
                <span className="rounded-full border border-cyan-500/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-400">
                  {room.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-sm text-zinc-400">
                <span>Host: {room.host}</span>
                <span>Theme: {room.theme}</span>
                <span>Capacity: {room.capacity}</span>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="text-sm text-zinc-500">Game: {room.gameSlug}</p>
                <Link href={`/rooms/${room.slug}`} className="text-cyan-400 hover:text-cyan-300">
                  Open room →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
