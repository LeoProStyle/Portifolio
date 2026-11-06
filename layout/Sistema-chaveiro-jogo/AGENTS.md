<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Portifolio** (396 symbols, 774 relationships, 31 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/Portifolio/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Portifolio/clusters` | All functional areas |
| `gitnexus://repo/Portifolio/processes` | All execution flows |
| `gitnexus://repo/Portifolio/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

# RetroKey

NFC-style cartridge (`/nfc/[id]`) validated against a game, then launched in an EmulatorJS iframe at `/play/[slug]`.

## Architecture Contract

> Dependency hierarchy. Check BEFORE implementing or reviewing.

### Apps
| app | kind | path | entry |
|---|---|---|---|
| retrokey | Next.js 14 App Router (frontend + API) | `.` (repo root) | `app/layout.tsx`, `app/**/page.tsx`, `app/api/**/route.ts`, `auth.ts`, `middleware.ts` |

### Layers
`app/**` (pages + API route handlers) → `components/**` → `lib/*` → `models/*`. Imports point inward only; inner never imports outer. No circular imports.

### Import Rules
| Layer | Can import |
|---|---|
| `app/**` | `components/**`, `lib/*`, `models/*` |
| `components/**` | `lib/*`, `models/*` |
| `lib/*` | other `lib/*`, `models/*` |
| `models/*` | nothing internal |

- Import modules by path through the `@/` alias; there are no barrel files.
- Public reads go through `lib/data.ts` (read model). Admin route handlers call `lib/mongo.ts` directly — keep that split explicit when changing data access.

## Technical Spec

> Token-efficient format for AI consumption.

**Generated:** 2026-11-05 | **Type:** SingleApp

### Stack
{"pkg":"npm","lang":"typescript 5.6","node":"24.x"}
{"framework":{"name":"Next.js","version":"14.2.15","router":"App Router"}}
{"frontend":{"ui":"React 18.2","styling":"Tailwind 3.4"}}
{"auth":{"lib":"next-auth 5 beta","mode":"single credentials admin"}}
{"database":{"engine":"MongoDB","access":"raw mongodb driver v7, no ORM"}}
{"storage":{"roms":"Cloudflare R2 via @aws-sdk/client-s3","fallback":"public/roms"}}
{"deploy":"Vercel"}

### Structure
{"pages":"app/**/page.tsx","api":"app/api/**/route.ts","components":"components/","lib":"lib/","models":"models/","tests":"tests/","e2e":"e2e/","seed":"scripts/seed.ts"}

### Domain
{"models":["Game","Cartridge","Room"],"location":"models/"}

### API Routes
{"prefix":"/api","location":"app/api/**/route.ts","adminPrefix":"/api/admin"}

### Commands
{"dev":"npm run dev (port 3001)","seed":"npm run seed","e2e":"npx playwright test e2e/"}

### Validation Gates
{"validation_gates":{"build":"npm run build","test":"node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts tests/play-theme.test.ts tests/emulator-cores.test.ts"}}

Typecheck runs inside `next build`. No lint or format gate exists.

[//]: # (codeadd-wiki:start)

## Project Knowledge Base

`.codeadd/wiki/` holds this project's patterns, conventions, workflows, and architecture
rationale. Entrypoint: `.codeadd/wiki/index.md`.

- CONSULT BEFORE exploring source for: project conventions, established patterns,
  workflow/how-to questions, architecture rationale ("why is it built this way").
- Do NOT consult for live structural facts (callers, impact, dependencies) — derive those
  from the code graph or the code itself.
- Pages carry `commit` + `sources` frontmatter. If sources changed since (see index.md
  staleness check), verify against code before relying on the page.
- Do not hand-edit generated pages; run /add-wiki update instead. INSTRUCTIONS.md is
  user-owned and steers regeneration.

[//]: # (codeadd-wiki:end)

[//]: # (codeadd-style:start)

## Writing Style

Describe the action, the mechanism or the state directly. Never put a figure of speech in its place.

- Applies to chat, docs, commit messages, PR descriptions, code comments and identifiers.
- Applies to the writing, not to the language of this rule — it holds in every output language.
- Established technical terms of figurative origin (branch, tree, cache, pipeline, parent, orphan) are the literal names of their concepts. Keep them.
- Test each sentence: does it name the action, or name something the action resembles? Replace a resemblance with the action.
- Not a list of banned words. One example of the device: "confirm the tests bite" → "run the tests and check they fail against the broken code".

[//]: # (codeadd-style:end)

[//]: # (codeadd-shell:start)

## Runtime policy
Run shipped framework entries with Node (>=22.19.0), e.g. `node .codeadd/scripts/status.cjs`.
No Bash, WSL or Git Bash is required; the entries are native CommonJS.
Headless callers (claude -p): read .codeadd/agent-mode/README.md.
Content longer than about 3 lines, or holding any quote, backslash, backtick or `${}`, is written with the file-write tool to `.codeadd/.temp/<random-slug>.<ext>`, passed by path and deleted in the same step after use; short one-liners stay inline.

[//]: # (codeadd-shell:end)
