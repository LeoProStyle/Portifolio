# Build ledger — feature: 0001F-SF01 — plan: docs/features/0001F-admin-secure-login/subfeatures/SF01-admin-api-guard/plan.md

Preflight: T05 produces `authConfig: NextAuthConfig`, T10 consumes `authConfig: NextAuthConfig` (T05) — match
Preflight: T06 produces `requireAdmin(request: Request): Promise<AdminGuardResult>`, T07 consumes the same (T06) — match
Preflight: T06 produces `requireAdmin(request: Request): Promise<AdminGuardResult>`, T08 consumes the same (T06) — match
Preflight: T09 produces `getAdminAuthStatus(response: Response): AdminAuthStatus | null`, T11 consumes the same (T09) — match
Preflight: T09 produces `ADMIN_LOGIN_URL`, T10 and T12 consume `ADMIN_LOGIN_URL` (T09) — match; T10 is edge runtime, so lib/admin-api.ts must keep no server imports
Preflight: T11 produces `onAuthError: (status: AdminAuthStatus) => void`, T12 consumes the same (T11) — match
Preflight: T01 (tests/auth-guard.test.ts) vs T06 (lib/auth-guard.ts) — test imports a module that does not exist until T06: tsconfig include **/*.ts makes `npm run build` typecheck tests/, so T01 commit fails the build gate; add--tdd rejects an import error as RED — CONFLICT
Ruling: T01 also creates lib/auth-guard.ts as a stub (exact signatures, types AdminIdentity/AdminGuardResult, bodies throw Error("not implemented")); T06 replaces the bodies — keeps build green and makes RED fail on behavior, not import — costs a throwing stub on the branch between T01 and T06 if T06 never lands (no route calls it before T07)
Preflight: T02 (tests/admin-api.test.ts) vs T09 (lib/admin-api.ts) — same import/build-gate conflict as T01 — CONFLICT
Ruling: T02 also creates lib/admin-api.ts as a stub (types AdminAuthStatus/AdminAuthErrorBody/AdminApiErrorBody, getAdminAuthStatus throws Error("not implemented"), ADMIN_LOGIN_URL = "" placeholder); T09 sets the real value and body — costs a wrong constant on the branch until T09 if T09 never lands (no caller before T10/T11)
Preflight: service order (test → backend → frontend) vs T10 (backend) Deps T09 (frontend) — CONFLICT
Ruling: dependency graph wins — run T09 before T10; backend area validator runs after T10, frontend validator after T12 — costs a backend validator range that contains one frontend commit (T09), which the reviewer must skip
Preflight: T01: Files tests/auth-guard.test.ts (+ stub per ruling); Deps -; Verify red then green after T06 — consistent after ruling
Preflight: T02: Files tests/admin-api.test.ts (+ stub per ruling); Deps -; Verify red then green after T09 — consistent after ruling
Preflight: T03: Files e2e/admin.qa.spec.ts, playwright.config.ts; Deps -; Verify needs dev server on 3001 and ADMIN_USERNAME/ADMIN_PASSWORD — consistent; expected red until T07/T08/T10/T12
Preflight: T04: Files package.json; Deps T01, T02 — consistent
Preflight: T05: Files auth.config.ts, auth.ts, types/next-auth.d.ts cover Produces authConfig — consistent
Preflight: T06: Files lib/auth-guard.ts cover both Produces; Deps T01, T05 — consistent
Preflight: T07: Files games handlers; Deps T03, T06 cover Consumes (T06) — consistent
Preflight: T08: Files cartridges handlers; Deps T03, T06 cover Consumes (T06) — consistent
Preflight: T09: Files lib/admin-api.ts cover Produces; Deps T02 — consistent
Preflight: T10: Files middleware.ts; Deps T03, T05, T09 cover Consumes (T05, T09) — consistent
Preflight: T11: Files GamesTab/CartridgesTab cover Produces onAuthError; Deps T09 cover Consumes — consistent
Preflight: T12: Files app/admin/page.tsx; Deps T03, T09, T11 cover Consumes — consistent
Preflight: e2e deferred to the last subfeature (qa-pipeline E2E Spec Authoring runs on SF04); T03 authors this SF's admin spec as a task
T01: complete (commits fe282828..d21dca4c, BUILD_STATUS=pass, validation at area end)
T02: complete (commits d21dca4c..b9e2db89, BUILD_STATUS=pass, validation at area end)
T04: complete (commits ..670ce1cd, BUILD_STATUS=pass, Verify: npm test runs 5 files, 19 tests, 11 red by design until T06/T09)
T03: complete (commit 5d6a43c8, BUILD_STATUS=pass, E2E red by design except T07/T12/T14 green; Mongo unreachable locally so cartridges routes 500 until guard)
T05: complete (commit 36f1b20f, BUILD_STATUS=pass, Verify: E2E T07 login reaches /admin green in isolation; batch-run flake from cold dev compile, MissingCSRF once)
Ruling: T12 E2E red locally is environmental - MongoDB unreachable (querySrv ENOTFOUND) and lib/admin-store.ts in-memory arrays are per route bundle in dev, so PUT after POST answers 404; pre-existing, not SF01 scope
test: fix round 1/3 (commit 89c1c076) - reviewer findings 1,2,4,5,8 fixed; 3 documented (run projects one at a time); 6 deferred minor (cartridge save/delete T10 variants need reachable Mongo); 7 carried to T06 (dynamic import of @/auth in requireAdmin); credential leak in Playwright error-context fixed
test: validated (reviewer-agent fix-needed -> fixed in round 1; main E2E: T07/T12/T14 green, rest red by design)
T06: complete (commit 8345bf29, BUILD_STATUS=pass, Verify: tests/auth-guard.test.ts 6/6 green)
test: fix round 2/3 (commit 202640e9) - loginAdminUi retries once after MissingCSRF on cold dev compile
T07: complete (commit e05c9424, BUILD_STATUS=pass, Verify: E2E T03/T11/T12/T13 green on cold dev server)
T08: complete (commit 503f44f2, BUILD_STATUS=pass, Verify: E2E T03/T11/T12/T13 green, T17 green on no-mongo project)
T09: complete (commit 958c762b, BUILD_STATUS=pass, Verify: npm test 19/19 green)
T10: complete (commit a2b61e24, BUILD_STATUS=pass with known jose CompressionStream edge warning, Verify: E2E T06/T07/T13/T14/T15 green)
backend: fix round 1/3 (commit 0d8923a7) - security-agent minor 4: admin session without user.id -> 401, unit test added (20/20)
backend: validated (security-agent PASS, no blockers; info findings 1-3 owned by SF02, 5 by SF04, 6 /api/logs out of scope)
Ruling: T11 and T12 committed together (01158c89) - onAuthError is a required prop, so T11 alone breaks the build gate
T11: complete (commit 01158c89, BUILD_STATUS=pass)
T12: complete (commit 01158c89, BUILD_STATUS=pass, Verify: E2E main 11/11 green incl. T10 x3, no-mongo T17 green)
frontend: fix round 1/3 (commit 20e75429) - reviewer minor: re-indent fragment children; focus-move on panel deferred minor (not in plan)
frontend: validated (reviewer-agent PASS, RF04 met)
T06: fix round 2/3 (final-review wave: 4 addressed FR-1 requireAdmin tests, FR-4 dev-db note, FR-8 maxAge comment, FR-12 error name in log; 0 open; commits 20e75429..9157a876; unit 24/24, build pass, E2E main 11/11)
Ruling: FR-2 (lib/auth-guard imports root @/auth, outside declared layers) kept - auth.ts is the composition root and the import is dynamic with an injectable reader; recording a root auth layer in AGENTS.md is left to /add-wiki update - cost if wrong: a layer-rule reviewer flags it again
Ruling: FR-3 (cartridge admin statuses/bodies unverified by E2E) accepted for this run - MongoDB unreachable from this machine (querySrv ENOTFOUND); guard runs before getDb so anonymous 401 is verified - cost if wrong: a cartridge regression ships unseen; rerun --project=main against a reachable MongoDB before merge
Ruling: FR-5 (tasks.md checklist unticked) handled in the checkpoint step - no code change
Ruling: FR-6/FR-9 (AUTH_SECRET literal fallback now the only key behind the guard) owned by SF02 RN01 fail-closed secret - SF02 must ship before treating the admin as production-safe - cost if wrong: forged admin JWT when AUTH_SECRET is unset
Ruling: FR-7 (page useSession redirect and pre-existing console.log in app/admin/page.tsx) left as is - pre-existing, not an SF01 defect
Ruling: FR-10 (plaintext compare, no rate limit, expectedUsername in rejection log) owned by SF02 - cost if wrong: brute force and username disclosure until SF02
Ruling: FR-11 (Next 14.2.15 below 14.2.25, next-auth beta unpinned) out of SF01 scope - recommend a dependency upgrade feature - cost if wrong: other Next CVEs stay open; the admin API barrier does not depend on middleware
Ruling: FR-13 (CSRF relies on SameSite=Lax session cookie) accepted - no custom cookie options exist - cost if wrong: cross-site mutation if cookie options change
Ruling: FR-14 (/api/logs POST public, log flooding) out of SF01 scope - cost if wrong: log noise
Ruling: FR-15 (body validation and romPath in admin handlers) owned by SF04
T06: minor (deferred): requireAdmin exports an overridable session reader; all 12 call sites pass none - add a convention note if a caller ever needs it
Final review: ruled 10 (after review-000)
Final review head: 9157a876249187390deb566222de1afd3798997e
Ruling: area fix rounds (test 1/3 89c1c076, test 2/3 202640e9, backend 1/3 0d8923a7, frontend 1/3 20e75429) re-reviewed by the Final Review, whose package fe282828..20e75429 covers every one of them; the final-review wave 20e75429..9157a876 got its own scoped re-review (4 addressed, 0 open) - cost if wrong: none beyond a second read
Compliance: RF01-RF04 and RN01-RN03 covered in code and tests (unit 24/24, E2E main 11/11, no-mongo T17); areas test, backend, frontend validated
