# Build ledger — feature: SF04-rom-path-containment — plan: docs/features/0001F-admin-secure-login/subfeatures/SF04-rom-path-containment/plan.md

Ruling: SF04 built instead of EPIC_CURRENT_SF=SF03 - epic.md Notes order SF01 -> SF02 -> SF04 -> SF03 and the user asked for SF04 - costs SF03 being planned against handlers SF04 changed, which SF04 keeps response shapes for
Preflight: T03 produces classifyRomPath(romPath: unknown, publicDir?: string): RomLocation; T04 consumes the same string - match
Preflight: T03 produces romPathForCreate(uploaded: string | undefined): string and romPathForUpdate(uploaded: string | undefined): { romPath?: string }; T05 consumes both, same strings - match
Preflight: T01 and T03 both list lib/rom-path.ts - T01 writes the throwing stub, T03 replaces the bodies; T03 Deps T01 - sequential, no conflict
Preflight: T01, T02 test tasks - no Consumes/Produces, Files cover T01-T06 and T07-T08 - self-consistent
Preflight: T04, T05 - Deps T02, T03 cover every Consumes producer and the red E2E - self-consistent
Preflight: T06 - Deps T05 (server ignores romPath before the form stops sending it), no interface - self-consistent
Ruling: the coordinator implements tasks directly instead of one implementer subagent per task, as in SF02 - 6 small tasks over 7 files with the plan and code already read; area validators and the final review stay independent subagents - costs a self-review blind spot if wrong, mitigated by the per-area reviewer and the final review
