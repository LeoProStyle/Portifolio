import Link from 'next/link';
import { getGames } from '@/lib/data';
import { systemOptions } from '@/lib/emulator-cores';
import { mockGames } from '@/lib/mock-data';
import { DEFAULT_PLAY_THEMES, resolvePlayTheme } from '@/lib/play-theme';
import type { Game } from '@/models/game';

// Lido a cada pedido: o catálogo muda pelo admin e o build não deve depender do MongoDB.
export const dynamic = 'force-dynamic';

const STEPS = [
  {
    title: 'Grave o link na tag',
    text: 'Cada tag NFC guarda o endereço de um jogo do catálogo. Não precisa de app nem de cadastro.'
  },
  {
    title: 'Encoste o celular',
    text: 'O celular lê a tag e abre o link no navegador, como qualquer página.'
  },
  {
    title: 'Jogue',
    text: 'O emulador carrega o jogo na hora, com o visual do console original.'
  }
];

const FEATURES = [
  {
    title: 'Tema de cada console',
    text: 'Os 12 consoles têm cores, moldura e proporção de tela próprias, inspiradas no aparelho original.'
  },
  {
    title: 'PC e celular',
    text: 'A tela de jogo ocupa a janela inteira, sem rolagem. No celular, o jogo fica com a maior área possível.'
  },
  {
    title: 'Bezel em telas largas',
    text: 'No computador, a arte do console aparece em volta do jogo. O admin envia um PNG por console.'
  },
  {
    title: 'Funciona mesmo com falhas',
    text: 'Sem banco de dados ou sem armazenamento, o jogo abre com os padrões definidos no código.'
  },
  {
    title: 'Painel de administração',
    text: 'Jogos, ROMs e bezels são cadastrados por uma área protegida por login.'
  },
  {
    title: 'Roda no navegador',
    text: 'Os jogos rodam com EmulatorJS, sem instalar nada no aparelho do jogador.'
  }
];

const STACK = ['Next.js 14', 'React 18', 'TypeScript', 'Tailwind CSS', 'MongoDB', 'Cloudflare R2', 'NextAuth', 'EmulatorJS', 'Playwright'];

const MOCK_GAME_IDS = new Set(mockGames.map((game) => game.id));

// O formulário do admin já gravou `active` como texto, então "true" também conta como ativo.
function isActive(game: Game): boolean {
  return String(game.active) === 'true';
}

async function loadCatalog(): Promise<Game[]> {
  try {
    const games = await getGames();
    return games
      .filter((game) => isActive(game) && !MOCK_GAME_IDS.has(game.id))
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  } catch (error) {
    console.error('[home] Falha ao carregar o catálogo', error);
    return [];
  }
}

export default async function HomePage() {
  const games = await loadCatalog();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="inline-flex min-h-11 items-center text-lg font-semibold tracking-tight">
          Retro<span className="text-cyan-400">Key</span>
        </Link>
        <nav aria-label="Seções da página" className="hidden gap-1 text-sm text-zinc-400 sm:flex">
          <a href="#como-funciona" className="inline-flex min-h-11 items-center rounded-md px-3 hover:text-zinc-100">
            Como funciona
          </a>
          <a href="#consoles" className="inline-flex min-h-11 items-center rounded-md px-3 hover:text-zinc-100">
            Consoles
          </a>
          <a href="#jogos" className="inline-flex min-h-11 items-center rounded-md px-3 hover:text-zinc-100">
            Jogos
          </a>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:pt-16">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Projeto de portfólio</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-6xl">
              Encoste a tag. O jogo abre no navegador.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-zinc-300">
              O RetroKey liga uma tag NFC a um jogo retrô. O jogador encosta o celular na tag e joga na hora, no
              celular ou no computador, com o visual do console original.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#jogos"
                className="inline-flex min-h-11 items-center rounded-full bg-cyan-500 px-6 font-medium text-zinc-950 transition hover:bg-cyan-400"
              >
                Ver os jogos
              </a>
              <a
                href="#como-funciona"
                className="inline-flex min-h-11 items-center rounded-full border border-zinc-700 px-6 font-medium text-zinc-100 transition hover:border-cyan-500"
              >
                Como funciona
              </a>
            </div>
          </div>

          <HeroIllustration />
        </section>

        <section id="como-funciona" className="border-t border-zinc-900 bg-zinc-900/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Como funciona</p>
            <h2 className="mt-3 text-3xl font-semibold">Três passos, nenhum aplicativo</h2>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15 text-lg font-semibold text-cyan-400"
                  >
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
                  <p className="mt-2 text-zinc-400">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">O que tem dentro</p>
          <h2 className="mt-3 text-3xl font-semibold">Feito para jogar sem configurar nada</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-zinc-400">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="consoles" className="border-t border-zinc-900 bg-zinc-900/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Consoles</p>
            <h2 className="mt-3 text-3xl font-semibold">12 consoles, cada um com o seu visual</h2>
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {systemOptions.map((option) => {
                const theme = DEFAULT_PLAY_THEMES[option.value];
                return (
                  <li
                    key={option.value}
                    className="flex min-h-14 items-center gap-3 rounded-xl border border-zinc-800 px-4"
                    style={{ backgroundColor: theme.bg }}
                  >
                    <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: theme.accent }} />
                    <span className="text-sm font-medium text-zinc-100">{option.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Tecnologia</p>
          <h2 className="mt-3 text-3xl font-semibold">Como foi construído</h2>
          <p className="mt-4 max-w-2xl text-zinc-400">
            Uma aplicação Next.js com rotas de API próprias. Os dados ficam no MongoDB, os arquivos no Cloudflare R2 e
            a área administrativa usa login com NextAuth. Testes de ponta a ponta com Playwright.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {STACK.map((item) => (
              <li key={item} className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-300">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section id="jogos" className="border-t border-zinc-900 bg-zinc-900/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Jogos</p>
            <h2 className="mt-3 text-3xl font-semibold">Catálogo</h2>
            {games.length === 0 ? (
              <p className="mt-8 rounded-2xl border border-dashed border-zinc-800 p-8 text-zinc-400">
                Nenhum jogo disponível no momento.
              </p>
            ) : (
              <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {games.map((game) => (
                  <GameCard key={game.slug} game={game} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-zinc-500">
          <p>RetroKey · projeto de portfólio</p>
          <Link href="/admin" className="inline-flex min-h-11 items-center px-2 text-zinc-500 hover:text-zinc-300">
            Admin
          </Link>
        </div>
      </footer>
    </div>
  );
}

function GameCard({ game }: { game: Game }) {
  const system = game.system || game.console || '';
  const theme = resolvePlayTheme(system || null);
  return (
    <li className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.accent }} />
        <span className="text-xs uppercase tracking-[0.2em] text-zinc-400">{system || 'Console'}</span>
      </div>
      <h3 className="mt-3 text-xl font-semibold">{game.title}</h3>
      {game.description ? <p className="mt-2 flex-1 text-zinc-400">{game.description}</p> : <div className="flex-1" />}
      <Link
        href={`/play/${encodeURIComponent(game.slug)}`}
        className="mt-6 inline-flex min-h-11 items-center self-start rounded-full bg-cyan-500 px-6 font-medium text-zinc-950 transition hover:bg-cyan-400"
      >
        Jogar
      </Link>
    </li>
  );
}

// Ilustração só com CSS: tag NFC → tela de jogo com o tema do NES.
function HeroIllustration() {
  const theme = DEFAULT_PLAY_THEMES.NES;
  return (
    <div aria-hidden="true" className="relative mx-auto flex w-full max-w-md items-center justify-center gap-6">
      <div className="flex h-28 w-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-900 shadow-lg shadow-black/40">
        <div className="h-10 w-10 rounded-full border-2 border-cyan-400/70" />
        <span className="mt-3 text-[10px] uppercase tracking-[0.2em] text-zinc-400">NFC</span>
      </div>
      <span className="text-2xl text-cyan-400">→</span>
      <div className="w-full rounded-3xl p-4 shadow-2xl shadow-black/50" style={{ backgroundColor: theme.frameColor }}>
        <div className="aspect-[4/3] w-full overflow-hidden rounded-lg" style={{ backgroundColor: theme.bg }}>
          <div className="grid h-full grid-cols-8 grid-rows-6 gap-1 p-3">
            {Array.from({ length: 48 }, (_, i) => (
              <div
                key={i}
                className="rounded-sm"
                style={{ backgroundColor: i % 7 === 0 || i % 11 === 0 ? theme.accent : 'transparent', opacity: 0.85 }}
              />
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="h-2 w-10 rounded-full" style={{ backgroundColor: theme.accent }} />
          <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-700">RetroKey</span>
        </div>
      </div>
    </div>
  );
}
