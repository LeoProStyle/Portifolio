'use client';

import { useEffect, useState } from 'react';
import type { Cartridge } from '@/models/cartridge';
import type { Game } from '@/models/game';

export default function CartridgesTab() {
  const [cartridges, setCartridges] = useState<Cartridge[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState({
    nfcId: '',
    gameId: '',
    collectionNumber: 0,
    status: 'active' as 'active' | 'disabled'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cartridgesRes, gamesRes] = await Promise.all([
        fetch('/api/admin/cartridges'),
        fetch('/api/admin/games')
      ]);

      if (cartridgesRes.ok) {
        setCartridges(await cartridgesRes.json());
      }

      if (gamesRes.ok) {
        setGames(await gamesRes.json());
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const response = await fetch('/api/admin/cartridges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          collectionNumber: parseInt(form.collectionNumber.toString())
        })
      });

      if (response.ok) {
        setFeedback('Cartridge created successfully.');
        setForm({
          nfcId: '',
          gameId: '',
          collectionNumber: 0,
          status: 'active'
        });
        loadData();
      } else {
        const data = await response.json().catch(() => ({}));
        setFeedback(data.error || 'Unable to create cartridge.');
      }
    } catch (error) {
      console.error('Failed to create cartridge:', error);
      setFeedback('Unable to create cartridge.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this cartridge?')) return;

    try {
      const response = await fetch(`/api/admin/cartridges/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setFeedback('Cartridge deleted.');
        loadData();
      } else {
        const data = await response.json().catch(() => ({}));
        setFeedback(data.error || 'Unable to delete cartridge.');
      }
    } catch (error) {
      console.error('Failed to delete cartridge:', error);
      setFeedback('Unable to delete cartridge.');
    }
  };

  const getGameTitle = (gameId: string) => {
    return games.find((g) => g.id === gameId)?.title || gameId;
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="text-xl font-semibold">Create new cartridge</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              type="text"
              placeholder="NFC ID"
              value={form.nfcId}
              onChange={(e) => setForm({ ...form, nfcId: e.target.value })}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500"
              required
            />
            <select
              value={form.gameId}
              onChange={(e) => setForm({ ...form, gameId: e.target.value })}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
              required
            >
              <option value="">Select a game</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.title}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Collection number"
              value={form.collectionNumber}
              onChange={(e) => setForm({ ...form, collectionNumber: parseInt(e.target.value) })}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500"
              required
            />
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'disabled' })}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          {feedback ? <p className="text-sm text-cyan-400">{feedback}</p> : null}

          <button
            type="submit"
            className="rounded bg-cyan-500 px-4 py-2 font-medium text-zinc-950 transition hover:bg-cyan-400"
          >
            Create cartridge
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="text-xl font-semibold">Cartridges list</h2>
        {loading ? (
          <p className="mt-4 text-zinc-400">Loading...</p>
        ) : cartridges.length === 0 ? (
          <p className="mt-4 text-zinc-400">No cartridges yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {cartridges.map((cartridge) => (
              <div key={cartridge.id} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900 p-3">
                <div>
                  <p className="font-medium">NFC: {cartridge.nfcId}</p>
                  <p className="text-sm text-zinc-400">
                    {getGameTitle(cartridge.gameId)} • #{cartridge.collectionNumber} • {cartridge.status}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(cartridge.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
