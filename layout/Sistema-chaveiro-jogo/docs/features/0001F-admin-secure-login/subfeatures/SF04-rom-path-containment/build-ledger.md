# Build ledger — feature: SF04-rom-path-containment — plan: docs/features/0001F-admin-secure-login/subfeatures/SF04-rom-path-containment/plan.md

Ruling: SF04 built instead of EPIC_CURRENT_SF=SF03 - epic.md Notes order SF01 -> SF02 -> SF04 -> SF03 and the user asked for SF04 - costs SF03 being planned against handlers SF04 changed, which SF04 keeps response shapes for
Preflight: T03 produces classifyRomPath(romPath: unknown, publicDir?: string): RomLocation; T04 consumes the same string - match
Preflight: T03 produces romPathForCreate(uploaded: string | undefined): string and romPathForUpdate(uploaded: string | undefined): { romPath?: string }; T05 consumes both, same strings - match
Preflight: T01 and T03 both list lib/rom-path.ts - T01 writes the throwing stub, T03 replaces the bodies; T03 Deps T01 - sequential, no conflict
Preflight: T01, T02 test tasks - no Consumes/Produces, Files cover T01-T06 and T07-T08 - self-consistent
Preflight: T04, T05 - Deps T02, T03 cover every Consumes producer and the red E2E - self-consistent
Preflight: T06 - Deps T05 (server ignores romPath before the form stops sending it), no interface - self-consistent
Ruling: the coordinator implements tasks directly instead of one implementer subagent per task, as in SF02 - 6 small tasks over 7 files with the plan and code already read; area validators and the final review stay independent subagents - costs a self-review blind spot if wrong, mitigated by the per-area reviewer and the final review
T01: complete (commits 858a02d6..13b2dccf, BUILD_STATUS=pass via tsc --noEmit on a test-only batch, verify red for the right reason 6/6 not implemented, validation at area end)
T02: complete (commits 13b2dccf..91ddc0d2, BUILD_STATUS=pass via tsc --noEmit on a test-only batch, verify red for the right reason - T07 body echoes details, T08 stores ../.env, validation at area end)
T03: complete (commits 91ddc0d2..5832dcb9, BUILD_STATUS=pass via tsc --noEmit (module not imported by the app yet), verify tests/rom-path.test.ts 6/6, validation at area end)
T04: impact NOT VERIFIED by GitNexus (git root two levels up, symbols unmapped) - text search: GET /api/rom/[slug] has one caller, components/Emulator.tsx:49 via the emulator iframe, which never reads the error body; wiki pages cite the old route lines and drift after this task
test: validated (commits 858a02d6..91ddc0d2, 0 blocking violations, 2 polish, SPEC_STATUS=COMPLETE)
test: minor (deferred): e2e/rom-path.qa.spec.ts T08 cleanup calls listGames with an expect in finally, which can mask the original failure (same pattern as SF01 cleanup)
test: minor (deferred): T07 relies on public/roms/super-retro.bin being absent; documented in the spec header, not guarded
T04: complete (commits 5832dcb9..794e48ae, BUILD_STATUS=pass via npm run build, verify e2e/rom-path.qa.spec.ts --project=main T07 green, T08 red until T05, validation at area end)
T05: complete (commits 794e48ae..ca594f69, BUILD_STATUS=pass via npm run build (jose Edge warning pre-existing), verify e2e/rom-path.qa.spec.ts + e2e/admin.qa.spec.ts --project=main 13 passed 1 skipped (T17 no-mongo), guard lines unchanged, impact NOT VERIFIED by GitNexus - text search: callers are components/admin/GamesTab.tsx and the E2E specs, validation at area end)
backend: validated (commits 91ddc0d2..ca594f69, 0 blocking violations, 3 polish, SPEC_STATUS=COMPLETE, no containment bypass found on POSIX or win32 semantics)
backend: minor (deferred): classifyRomPath accepts Windows reserved device names such as /roms/CON on win32 dev; needs a hand-written stored value and does not apply to the Linux target
backend: minor (deferred): fetchRomFromR2 logs the format-validated R2 key server-side; client bodies never carry it
backend: minor (deferred): Content-Disposition filename is not escaped; only builder-generated names reach public/roms today
