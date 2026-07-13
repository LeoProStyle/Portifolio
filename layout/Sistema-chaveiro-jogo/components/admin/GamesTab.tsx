'use client';

import { useEffect, useState } from 'react';
import type { Game } from '@/models/game';
import { systemOptions } from '@/lib/emulator-cores';

interface GameFormState {
  title: string;
  system: string;
  slug: string;
  description: string;
  image: string;
  romPath: string;
  active: boolean;
}

export default function GamesTab() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [romFile, setRomFile] = useState<File | null>(null);
  const [form, setForm] = useState<GameFormState>({
    title: '',
    system: '',
    slug: '',
    description: '',
    image: '',
    romPath: '',
    active: true
  });

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    try {
      const response = await fetch('/api/admin/games');
      if (response.ok) {
        const data = await response.json();
        setGames(data);
      }
    } catch (error) {
      console.error('Failed to load games:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      title: '',
      system: '',
      slug: '',
      description: '',
      image: '',
      romPath: '',
      active: true
    });
    setEditingId(null);
    setRomFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    try {
      const endpoint = editingId ? `/api/admin/games/${editingId}` : '/api/admin/games';
      const method = editingId ? 'PUT' : 'POST';
      const formData = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          formData.append(key, value ? 'true' : 'false');
        } else {
          formData.append(key, value);
        }
      });

      if (romFile) {
        formData.append('romFile', romFile);
      }

      const response = await fetch(endpoint, {
        method,
        body: formData
      });

      if (response.ok) {
        setFeedback(editingId ? 'Game updated successfully.' : 'Game created successfully.');
        resetForm();
        loadGames();
      } else {
        const data = await response.json().catch(() => ({}));
        setFeedback(data.error || (editingId ? 'Unable to update game.' : 'Unable to create game.'));
      }
    } catch (error) {
      console.error('Failed to save game:', error);
      setFeedback(editingId ? 'Unable to update game.' : 'Unable to create game.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this game?')) return;

    try {
      const response = await fetch(`/api/admin/games/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setFeedback('Game deleted.');
        loadGames();
      } else {
        const data = await response.json().catch(() => ({}));
        setFeedback(data.error || 'Unable to delete game.');
      }
    } catch (error) {
      console.error('Failed to delete game:', error);
      setFeedback('Unable to delete game.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">{editingId ? 'Edit game' : 'Add new game'}</h2>
          {editingId ? (
            <button type="button" onClick={resetForm} className="text-sm text-cyan-400 hover:text-cyan-300">
              Cancel edit
            </button>
          ) : null}
        </div>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              type="text"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500"
              required
            />
            <label className="flex flex-col gap-2">
              <span className="text-sm text-zinc-400">Console / Sistema</span>
              <select
                value={form.system}
                onChange={(e) => setForm({ ...form, system: e.target.value })}
                className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
                required
              >
                <option value="">Selecione um sistema</option>
                {systemOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <input
              type="text"
              placeholder="Slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500"
              required
            />
            <input
              type="text"
              placeholder="ROM path"
              value={form.romPath}
              onChange={(e) => setForm({ ...form, romPath: e.target.value })}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500"
            />
          </div>
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500"
            rows={3}
          />
          <div className="rounded border border-dashed border-zinc-700 p-3">
            <label className="mb-2 block text-sm text-zinc-400">ROM file</label>
            <input
              type="file"
              accept=".bin,.gen,.nes,.smc,.sfc,.gba,.gb,.md,.iso"
              onChange={(e) => setRomFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-950 hover:file:bg-cyan-400"
            />
            {form.romPath ? <p className="mt-2 text-sm text-zinc-500">Current ROM path: {form.romPath}</p> : null}
          </div>
          {feedback ? <p className="text-sm text-cyan-400">{feedback}</p> : null}

          <button
            type="submit"
            className="rounded bg-cyan-500 px-4 py-2 font-medium text-zinc-950 transition hover:bg-cyan-400"
          >
            {editingId ? 'Update game' : 'Create game'}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="text-xl font-semibold">Games list</h2>
        {loading ? (
          <p className="mt-4 text-zinc-400">Loading...</p>
        ) : games.length === 0 ? (
          <p className="mt-4 text-zinc-400">No games yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {games.map((game) => (
              <div key={game.id} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900 p-3">
                <div>
                  <p className="font-medium">{game.title}</p>
                  <p className="text-sm text-zinc-400">{game.system || game.console}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditingId(game.id);
                      setForm({
                        title: game.title,
                        system: game.system || game.console || '',
                        slug: game.slug,
                        description: game.description,
                        image: game.image,
                        romPath: game.romPath,
                        active: game.active
                      });
                      setRomFile(null);
                    }}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => {
                      // Open the play route in a new tab to test the game
                      try {
                        const origin = typeof window !== 'undefined' ? window.location.origin : '';
                        const url = `${origin || ''}/play/${game.slug}`;
                        if (typeof window !== 'undefined') {
                          window.open(url, '_blank');
                        }
                        setFeedback(`Opened tester for ${game.title}`);
                      } catch (err) {
                        console.error('Failed to open tester', err);
                        setFeedback('Unable to open tester.');
                      }
                    }}
                    className="text-emerald-400 hover:text-emerald-300"
                    title={`Test ${game.title}`}
                  >
                    Testar
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        const origin = typeof window !== 'undefined' ? window.location.origin : '';
                        const link = `${origin || ''}/play/${game.slug}`;
                        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                          await navigator.clipboard.writeText(link);
                          setFeedback(`Link copiado: ${link}`);
                        } else if (typeof window !== 'undefined') {
                          // Fallback: prompt the link so user can copy manually
                          // eslint-disable-next-line no-alert
                          window.prompt('Copy this link for your NFC tag:', link);
                          setFeedback('Link exibido para cópia.');
                        } else {
                          setFeedback(`Link disponível: ${link}`);
                        }
                      } catch (err) {
                        console.error('Failed to copy link', err);
                        setFeedback('Unable to copy link.');
                      }
                    }}
                    className="text-yellow-400 hover:text-yellow-300"
                    title={`Copy play link for ${game.title}`}
                  >
                    Link
                  </button>

                  <button
                    onClick={() => handleDelete(game.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
