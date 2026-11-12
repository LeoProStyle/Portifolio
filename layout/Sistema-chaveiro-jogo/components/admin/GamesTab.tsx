'use client';

import { useEffect, useState } from 'react';
import type { Game } from '@/models/game';
import { systemOptions } from '@/lib/emulator-cores';
import { getAdminAuthStatus, type AdminApiErrorBody, type AdminAuthStatus } from '@/lib/admin-api';
import type { IgdbGame } from '@/lib/igdb';

const IGDB_MIN_TERM_LENGTH = 2;
const IGDB_SEARCH_DELAY_MS = 300;

// Same rule as normalizeSlug in lib/data.ts (that module is server-only).
function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

interface GameFormState {
  title: string;
  system: string;
  slug: string;
  description: string;
  image: string;
  romPath: string;
  active: boolean;
}

interface GamesTabProps {
  onAuthError: (status: AdminAuthStatus) => void;
}

export default function GamesTab({ onAuthError }: GamesTabProps) {
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

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<IgdbGame[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [selectedIgdbGame, setSelectedIgdbGame] = useState<IgdbGame | null>(null);

  useEffect(() => {
    loadGames();
  }, []);

  useEffect(() => {
    const term = searchTerm.trim();
    if (!form.system || term.length < IGDB_MIN_TERM_LENGTH || term === selectedIgdbGame?.name) {
      setSearchResults([]);
      setSearching(false);
      setSearchMessage(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchMessage(null);
      try {
        const params = new URLSearchParams({ system: form.system, q: term });
        const response = await fetch(`/api/admin/igdb/search?${params.toString()}`, { signal: controller.signal });
        const authStatus = getAdminAuthStatus(response);
        if (authStatus) {
          onAuthError(authStatus);
          return;
        }
        if (!response.ok) {
          setSearchResults([]);
          setSearchMessage(
            response.status === 503
              ? 'IGDB não configurado no servidor. Preencha os campos manualmente.'
              : 'Não foi possível buscar no IGDB. Preencha os campos manualmente.'
          );
          return;
        }
        const data: IgdbGame[] = await response.json();
        setSearchResults(data);
        if (data.length === 0) setSearchMessage('Nenhum jogo encontrado para este console.');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Failed to search IGDB:', error);
          setSearchMessage('Não foi possível buscar no IGDB. Preencha os campos manualmente.');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, IGDB_SEARCH_DELAY_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.system, searchTerm, selectedIgdbGame, onAuthError]);

  const resetSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSearchMessage(null);
    setSelectedIgdbGame(null);
  };

  const selectIgdbGame = (game: IgdbGame) => {
    setSelectedIgdbGame(game);
    setSearchTerm(game.name);
    setSearchResults([]);
    setSearchMessage(null);
    setForm((current) => ({
      ...current,
      title: game.name,
      slug: editingId ? current.slug : slugFromTitle(game.name),
      description: game.summary,
      image: game.coverUrl || ''
    }));
  };

  const loadGames = async () => {
    try {
      const response = await fetch('/api/admin/games');
      const authStatus = getAdminAuthStatus(response);
      if (authStatus) {
        onAuthError(authStatus);
        return;
      }
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
    resetSearch();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    try {
      const endpoint = editingId ? `/api/admin/games/${editingId}` : '/api/admin/games';
      const method = editingId ? 'PUT' : 'POST';
      const formData = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        // The server derives romPath from romFile; the form only shows the current value.
        if (key === 'romPath') return;
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

      const authStatus = getAdminAuthStatus(response);
      if (authStatus) {
        onAuthError(authStatus);
        return;
      }

      if (response.ok) {
        setFeedback(editingId ? 'Game updated successfully.' : 'Game created successfully.');
        resetForm();
        loadGames();
      } else {
        const data: AdminApiErrorBody = await response.json().catch(() => ({}));
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

      const authStatus = getAdminAuthStatus(response);
      if (authStatus) {
        onAuthError(authStatus);
        return;
      }

      if (response.ok) {
        setFeedback('Game deleted.');
        loadGames();
      } else {
        const data: AdminApiErrorBody = await response.json().catch(() => ({}));
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
            <label className="flex flex-col gap-2">
              <span className="text-sm text-zinc-400">1. Console / Sistema</span>
              <select
                value={form.system}
                onChange={(e) => {
                  setForm({ ...form, system: e.target.value });
                  resetSearch();
                }}
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
            <div className="relative flex flex-col gap-2">
              <label htmlFor="igdb-search" className="text-sm text-zinc-400">
                2. Buscar jogo no IGDB
              </label>
              <input
                id="igdb-search"
                type="search"
                autoComplete="off"
                placeholder={form.system ? 'Digite o nome do jogo' : 'Selecione um sistema primeiro'}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedIgdbGame(null);
                }}
                disabled={!form.system}
                className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500 disabled:opacity-50"
              />
              {searching ? <p className="text-xs text-zinc-500">Buscando...</p> : null}
              {searchMessage ? <p className="text-xs text-amber-400">{searchMessage}</p> : null}
              {searchResults.length > 0 ? (
                <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-80 overflow-y-auto rounded border border-zinc-700 bg-zinc-900 shadow-lg">
                  {searchResults.map((game) => (
                    <li key={game.id}>
                      <button
                        type="button"
                        onClick={() => selectIgdbGame(game)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-800"
                      >
                        {game.thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={game.thumbUrl} alt="" className="h-12 w-9 flex-none rounded object-cover" />
                        ) : (
                          <span className="h-12 w-9 flex-none rounded bg-zinc-800" />
                        )}
                        <span className="text-sm text-zinc-100">
                          {game.name}
                          {game.year ? <span className="ml-2 text-zinc-500">({game.year})</span> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          {selectedIgdbGame || form.image ? (
            <div className="flex flex-col gap-4 rounded border border-zinc-800 bg-zinc-900 p-4 sm:flex-row">
              {form.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.image}
                  alt={`Capa de ${form.title || 'jogo'}`}
                  className="h-48 w-36 flex-none rounded object-cover"
                />
              ) : (
                <div className="flex h-48 w-36 flex-none items-center justify-center rounded bg-zinc-800 text-xs text-zinc-500">
                  Sem capa
                </div>
              )}
              <div className="min-w-0 space-y-1">
                <p className="text-lg font-semibold text-zinc-100">{form.title || 'Sem título'}</p>
                {selectedIgdbGame ? (
                  <p className="text-sm text-zinc-400">
                    {[selectedIgdbGame.year, selectedIgdbGame.genres.join(', ')].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
                {form.description ? (
                  <p className="line-clamp-6 text-sm text-zinc-300">{form.description}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              type="text"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500"
              required
            />
            <input
              type="text"
              placeholder="Slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500"
              required
            />
          </div>
          <input
            type="url"
            placeholder="URL da capa"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500"
          />
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder-zinc-500"
            rows={5}
          />
          <div className="rounded border border-dashed border-zinc-700 p-3">
            <label className="mb-2 block text-sm text-zinc-400">ROM file</label>
            <input
              type="file"
              accept=".nes,.smc,.sfc,.n64,.z64,.v64,.gb,.gbc,.gba,.sms,.gg,.md,.gen,.smd,.32x,.bin,.iso,.chd,.pbp,.zip,.7z"
              onChange={(e) => setRomFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-950 hover:file:bg-cyan-400"
            />
            {form.romPath ? (
              <p className="mt-2 text-sm text-zinc-500">Caminho atual da ROM: {form.romPath}</p>
            ) : romFile ? null : (
              <p className="mt-2 text-sm text-amber-400">Envie um arquivo de ROM para o jogo funcionar.</p>
            )}
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
                      resetSearch();
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
