import Link from 'next/link';
import { Inter, Unbounded } from 'next/font/google';
import FeaturedCarousel from '@/components/home/FeaturedCarousel';
import KeyCartridge from '@/components/home/KeyCartridge';
import LibraryGrid from '@/components/home/LibraryGrid';
import Reveal from '@/components/home/Reveal';
import { getGames } from '@/lib/data';
import { systemOptions } from '@/lib/emulator-cores';
import { buildShowcase, getDefaultCoverLookup, pickFeatured, type ShowcaseGame } from '@/lib/game-showcase';
import { DEFAULT_PLAY_THEMES } from '@/lib/play-theme';

// Lido a cada pedido: o catálogo muda pelo admin e o build não deve depender do MongoDB.
export const dynamic = 'force-dynamic';

const display = Unbounded({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-display' });
const body = Inter({ subsets: ['latin'], variable: '--font-body' });

const PHONE_STEPS = [
  { title: 'Encoste', text: 'Aproxime o celular do chaveiro. A tag NFC abre o jogo no navegador.' },
  { title: 'Carregue', text: 'O emulador baixa a ROM e veste o tema do console original.' },
  { title: 'Jogue', text: 'Controle na tela, em tela cheia, sem instalar nada.' }
];

const STACK = ['Next.js 14', 'React 18', 'TypeScript', 'Tailwind CSS', 'MongoDB', 'Cloudflare R2', 'NextAuth', 'EmulatorJS', 'IGDB API', 'Playwright'];

async function loadShowcase(): Promise<ShowcaseGame[]> {
  try {
    return await buildShowcase(await getGames(), getDefaultCoverLookup());
  } catch (error) {
    console.error('[home] Falha ao carregar o catálogo', error);
    return [];
  }
}

export default async function HomePage({ searchParams }: { searchParams: { console?: string } }) {
  const games = await loadShowcase();
  const featured = pickFeatured(games);
  const hanging = featured.slice(0, 3);
  const countBySystem = new Map<string, number>();
  for (const game of games) countBySystem.set(game.system, (countBySystem.get(game.system) ?? 0) + 1);

  return (
    <div className={`home-root ${display.variable} ${body.variable} min-h-screen overflow-x-clip font-body text-zinc-100`}>
      <SiteHeader />

      <main>
        {/* Intro: a marca e o chaveiro */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            <div className="absolute -left-40 top-10 h-[520px] w-[520px] animate-drift rounded-full bg-brass/20 blur-[120px]" />
            <div className="absolute right-[-10%] top-[-10%] h-[600px] w-[600px] animate-drift rounded-full bg-signal/15 blur-[140px] [animation-delay:-6s]" />
            <div className="absolute bottom-[-20%] left-1/3 h-[500px] w-[500px] animate-drift rounded-full bg-fuchsia-500/10 blur-[140px] [animation-delay:-12s]" />
            <div className="home-scanlines absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
          </div>

          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-20">
            <div className="animate-rise">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-zinc-300 ring-1 ring-white/10">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-pulsering rounded-full bg-signal" />
                  <span className="relative h-2 w-2 rounded-full bg-signal" />
                </span>
                NFC · Navegador · 12 consoles
              </p>
              <h1 className="mt-6 font-display text-[2.6rem] font-extrabold leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
                Seu jogo retrô <span className="bg-gradient-to-r from-brass via-brass-300 to-signal bg-clip-text text-transparent">cabe num chaveiro.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-300">
                Encoste o celular no chaveiro RetroKey e o jogo abre na hora, no navegador. Sem app, sem cadastro, com o
                visual do console original. Quer a tela grande? Pareie com o computador em 6 dígitos.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href="#biblioteca"
                  className="inline-flex min-h-12 items-center rounded-full bg-brass px-7 font-bold text-ink shadow-[0_10px_40px_-10px_rgba(255,194,75,0.8)] transition hover:-translate-y-0.5 hover:bg-brass-300"
                >
                  Explorar jogos
                </a>
                <Link
                  href="/connect"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/5 px-6 font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/10"
                >
                  <MonitorIcon /> Jogar no PC
                </Link>
              </div>

              <dl className="mt-12 grid max-w-xl grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
                <Stat value={games.length} label="jogos no catálogo" />
                <Stat value={countBySystem.size} label="consoles com jogos" />
                <Stat value={systemOptions.length} label="consoles suportados" />
                <Stat value={0} label="apps para instalar" />
              </dl>
            </div>

            {hanging.length > 0 ? <KeychainCluster games={hanging} /> : null}
          </div>
        </section>

        <ConsoleMarquee />

        {featured.length > 0 ? (
          <section id="destaques" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 sm:px-8 lg:py-24">
            <Reveal>
              <SectionTitle eyebrow="Em destaque" title="Escolha e aperte start" />
              <div className="mt-10">
                <FeaturedCarousel games={featured} />
              </div>
            </Reveal>
          </section>
        ) : null}

        <section id="biblioteca" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-16 sm:px-8 lg:pb-24">
          <Reveal>
            <SectionTitle
              eyebrow="Biblioteca"
              title="Todos os cartuchos"
              text="Capas, ano e gênero vêm do IGDB quando o catálogo não traz. Clique em um jogo para abrir direto no navegador."
            />
            <div className="mt-10">
              {games.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-zinc-400">
                  Nenhum jogo disponível no momento.
                </p>
              ) : (
                <LibraryGrid key={searchParams?.console ?? 'todos'} games={games} initialSystem={searchParams?.console} />
              )}
            </div>
          </Reveal>
        </section>

        <section id="como-funciona" className="relative scroll-mt-24 border-y border-white/5 bg-ink-900">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
            <Reveal>
              <SectionTitle eyebrow="Como funciona" title="Do chaveiro ao jogo, em segundos" />
              <div className="mt-12 grid gap-6 lg:grid-cols-2">
                <article className="rounded-[28px] bg-ink-800 p-7 ring-1 ring-white/5 sm:p-9">
                  <div className="flex items-center gap-3">
                    <IconBadge>
                      <PhoneIcon />
                    </IconBadge>
                    <h3 className="font-display text-xl font-semibold text-white">No celular</h3>
                  </div>
                  <ol className="mt-8 space-y-6">
                    {PHONE_STEPS.map((step, index) => (
                      <li key={step.title} className="flex gap-5">
                        <span aria-hidden="true" className="font-display text-3xl font-bold text-outline">
                          0{index + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-white">{step.title}</p>
                          <p className="mt-1 text-zinc-400">{step.text}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>

                <article className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brass/15 via-ink-800 to-ink-800 p-7 ring-1 ring-brass/20 sm:p-9">
                  <div className="flex items-center gap-3">
                    <IconBadge>
                      <MonitorIcon />
                    </IconBadge>
                    <h3 className="font-display text-xl font-semibold text-white">No computador</h3>
                  </div>
                  <p className="mt-6 max-w-md text-zinc-300">
                    Encoste o chaveiro no celular e toque em <strong className="text-white">Jogar no PC</strong>. O celular
                    mostra um código de 6 dígitos. Digite o código no computador e o jogo abre na tela grande.
                  </p>
                  <div aria-hidden="true" className="mt-8 flex gap-2">
                    {['4', '8', '2', '9', '1', '6'].map((digit, i) => (
                      <span
                        key={i}
                        className="flex h-14 w-11 animate-rise items-center justify-center rounded-xl bg-ink font-display text-2xl font-bold text-brass ring-1 ring-brass/30 sm:h-16 sm:w-12"
                        style={{ animationDelay: `${i * 90}ms` }}
                      >
                        {digit}
                      </span>
                    ))}
                  </div>
                  <Link
                    href="/connect"
                    className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-brass px-6 font-bold text-ink transition hover:bg-brass-300"
                  >
                    Digitar código <span aria-hidden="true">→</span>
                  </Link>
                </article>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="consoles" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 sm:px-8 lg:py-24">
          <Reveal>
            <SectionTitle
              eyebrow="Consoles"
              title="12 consoles, cada um com a sua cara"
              text="Cada console tem cores, moldura e proporção de tela próprias na hora de jogar."
            />
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {systemOptions.map((option) => {
                const theme = DEFAULT_PLAY_THEMES[option.value];
                const count = countBySystem.get(option.value) ?? 0;
                const card = (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-1.5 transition-all duration-500 group-hover:h-full group-hover:opacity-20"
                      style={{ backgroundColor: theme.accent }}
                    />
                    <span
                      aria-hidden="true"
                      className="relative mb-6 block h-8 w-12 rounded-md ring-1 ring-white/10"
                      style={{ backgroundImage: `linear-gradient(160deg, ${theme.frameColor}, ${theme.bg})` }}
                    />
                    <span className="relative block font-semibold text-white">{option.label}</span>
                    <span className="relative mt-1 block text-sm" style={{ color: count > 0 ? theme.accent : '#71717A' }}>
                      {count > 0 ? `${count} ${count === 1 ? 'jogo' : 'jogos'}` : 'Em breve'}
                    </span>
                  </>
                );
                const cardClass =
                  'group relative block h-full overflow-hidden rounded-2xl p-5 ring-1 ring-white/5 transition duration-300';
                return (
                  <li key={option.value}>
                    {count > 0 ? (
                      <Link
                        href={`/?console=${encodeURIComponent(option.value)}#biblioteca`}
                        scroll={false}
                        className={`${cardClass} hover:-translate-y-1 hover:ring-white/20`}
                        style={{ backgroundColor: theme.bg }}
                      >
                        {card}
                      </Link>
                    ) : (
                      <div className={cardClass} style={{ backgroundColor: theme.bg }}>
                        {card}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </section>

        <section className="border-t border-white/5">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brass">Por dentro</p>
              <h2 className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">Como foi construído</h2>
              <p className="mt-4 max-w-lg text-zinc-400">
                Aplicação com rotas próprias, banco de dados, armazenamento de arquivos, área administrativa protegida
                por login, capas do IGDB e testes automatizados.
              </p>
            </Reveal>
            <ul className="flex flex-wrap gap-2">
              {STACK.map((item) => (
                <li key={item} className="rounded-full bg-white/5 px-4 py-2 text-sm text-zinc-300 ring-1 ring-white/10">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-zinc-500 sm:px-8">
          <p className="flex items-center gap-2">
            <KeyIcon className="h-4 w-4 text-brass" /> RetroKey · projeto de LeoProStyle
          </p>
          <div className="flex gap-1">
            <Link href="/connect" className="inline-flex min-h-11 items-center px-3 hover:text-zinc-300">
              Jogar no PC
            </Link>
            <Link href="/admin" className="inline-flex min-h-11 items-center px-3 hover:text-zinc-300">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SiteHeader() {
  const links = [
    { href: '#destaques', label: 'Destaques' },
    { href: '#biblioteca', label: 'Biblioteca' },
    { href: '#como-funciona', label: 'Como funciona' },
    { href: '#consoles', label: 'Consoles' }
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-ink/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 font-display text-lg font-bold tracking-tight text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brass text-ink">
            <KeyIcon className="h-4 w-4" />
          </span>
          <span>
            Retro<span className="text-brass">Key</span>
          </span>
        </Link>
        <nav aria-label="Seções da página" className="hidden gap-1 text-sm font-medium text-zinc-400 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="inline-flex min-h-11 items-center rounded-full px-4 transition hover:bg-white/5 hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>
        <Link
          href="/connect"
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-ink transition hover:bg-brass"
        >
          <MonitorIcon /> <span className="hidden sm:inline">Jogar no PC</span>
          <span className="sm:hidden">PC</span>
        </Link>
      </div>
    </header>
  );
}

// Até três cartuchos-chaveiro lado a lado, cada um balançando no seu tempo.
function KeychainCluster({ games }: { games: ShowcaseGame[] }) {
  const slots = [
    { className: 'left-[2%] top-16 w-[34%] -rotate-[14deg]', delay: '-1.2s' },
    { className: 'left-1/2 top-10 z-10 w-[40%] -translate-x-1/2', delay: '0s' },
    { className: 'right-[2%] top-16 w-[34%] rotate-[14deg]', delay: '-2.6s' }
  ];
  const order = games.length === 1 ? [1] : games.length === 2 ? [0, 2] : [0, 1, 2];
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-[1/1.05] w-full max-w-[460px] animate-rise [animation-delay:150ms]">
      {games.map((game, i) => {
        const slot = slots[order[i]];
        return (
          <div key={game.slug} className={`absolute ${slot.className}`}>
            <KeyCartridge game={game} eager swingDelay={slot.delay} />
          </div>
        );
      })}
    </div>
  );
}

function ConsoleMarquee() {
  const names = systemOptions.map((option) => option.label);
  return (
    <div aria-hidden="true" className="relative overflow-hidden border-y border-white/5 bg-ink-900 py-5">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
        {[...names, ...names].map((name, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-2xl font-bold uppercase sm:text-3xl">
            <span className={i % 2 === 0 ? 'text-outline' : 'text-white/80'}>{name}</span>
            <KeyIcon className="h-5 w-5 text-brass" />
          </span>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brass">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">{title}</h2>
      {text ? <p className="mt-4 text-zinc-400">{text}</p> : null}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-3xl font-bold text-white">{value}</dd>
      <dd aria-hidden="true" className="mt-1 text-xs uppercase tracking-[0.15em] text-zinc-500">
        {label}
      </dd>
    </div>
  );
}

function IconBadge({ children }: { children: React.ReactNode }) {
  return <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-brass ring-1 ring-white/10">{children}</span>;
}

function KeyIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="8" cy="8" r="5" />
      <path d="M11.5 11.5L21 21M17 17l2.5-2.5M14.5 14.5l2-2" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  );
}
