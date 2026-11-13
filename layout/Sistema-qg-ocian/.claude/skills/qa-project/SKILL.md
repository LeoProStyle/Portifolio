---
name: qa-project
description: Use when authoring E2E specs (/add-build) or judging QA (/add-review) in this project — carries the project-specific runner conventions + managed app lifecycle.
---

# Project QA Conventions

## Conventions
- **Runner:** @playwright/test (1.64.x, devDependency; chromium installed)
- **Run one spec:** `npx playwright test e2e/<surface>.qa.spec.ts`
- **Run full suite:** `npx playwright test e2e/`
- **Spec location + naming:** `e2e/` · `<surface>.qa.spec.ts` (keep the `e2e/` path filter: `tests/*.test.ts` are `node --test` unit tests and must not be picked up by Playwright)
- **Selectors:** MANDATORY `getByRole` / `data-testid` — never brittle CSS/xpath.
- **Screenshots:** `page.screenshot({ path, fullPage: true })` → `_tests/run-NNN/screenshots/<screen>.<state>.<viewport>.png` (one file per screen × state × viewport; `<state>` from the spec's `capture states`, `default` when single-state)
- **Computed styles:** `_tests/run-NNN/computed-styles/<screen>.<viewport>.json` (minified; one file per screen × viewport, capturing the resolved values for each `## Design Contract` dimension verified by computed style)
- **a11y:** @axe-core/playwright — `new AxeBuilder({ page }).analyze()`
- **Evidence lifecycle:** allocate with `.codeadd/scripts/qa-evidence.cjs next`; new runs write only to `_tests/run-NNN/`. `/add-done` alone promotes the reviewed baseline to immutable `_tests/final/run-NNN/`.

## Managed App Lifecycle
Both `/add-build` (E2E green-confirm) and `/add-review` (QA run) invoke this procedure:
1. **Probe** `qa.baseUrl` (from `.codeadd/settings.json`).
2. If **down**: boot the app as a managed process (this step owns it and tears it down in step 4 — it is not pending work) using `npm run dev` (Next.js on port 3001, from `qa.bootHint` in `.codeadd/settings.json`), then **wait-for-ready** by polling `baseUrl` with a bounded timeout.
3. **Run** the spec(s).
4. **Teardown** the app **iff we booted it** — never kill a dev server the user already had running.
5. On **boot failure / timeout**: do NOT hang — author-only and **defer the run to `/add-review`** with a flagged note.

## Auth / Seed
- Admin screens (`/admin`, game management: add/remove games) sit behind the NextAuth credentials login at `/login`. Sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env.local` (dev fallback in `lib/auth-config.ts` when both are unset). Game/cartridge data comes from `npm run seed`. Never hardcode the credentials in a spec — read them from the environment.
