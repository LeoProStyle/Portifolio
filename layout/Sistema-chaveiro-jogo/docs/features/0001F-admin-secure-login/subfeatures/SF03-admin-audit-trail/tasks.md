# Tasks: 0001F-SF03 admin-audit-trail

## Metadata

| Field | Value |
|-------|-------|
| Complexity | STANDARD |
| Total tasks | 8 |
| Services | test, database, backend |

## Requirements Coverage

- [ ] RF01 — login bem-sucedido, falho e bloqueado gravado em `admin_audit`
- [ ] RF02 — criação, edição e remoção de jogo ou cartucho gravadas em `admin_audit`
- [ ] RF03 — cada registro tem usuário, ação, tipo e id do alvo, data/hora e IP (`getClientIp`)
- [ ] RF04 — login: alvo `login`/`null`; ação admin: `usuário` = id da sessão do guard; falha/bloqueio: nome tentado (nunca o configurado)
- [ ] RN01 — nenhum registro contém corpo, senha, hash ou token
- [ ] RN02 — toda gravação também sai no console com o prefixo `[audit]`
- [ ] RN03 — falha ao gravar a auditoria não desfaz nem bloqueia a ação; o erro é logado

## TDD

- [ ] T-TEST-01 Contract tests RN01/RN02/RN03/RF03/RF04 for the audit module (T01-T05) — `tests/admin-audit.test.ts`
- [ ] T-TEST-02 Contract tests RF01/RF04/RN01/RN03 for login auditing (T06-T10) — `tests/admin-login.test.ts`
- [ ] T-TEST-03 Mongo store contract RF01/RF02/RF03 against `retrokey_e2e` (T11) — `tests/admin-audit-mongo.test.ts`
- [ ] T-TEST-04 E2E contract RF01-RF04/RN01 (T12, T13) and RN03 (T14) — `e2e/audit.qa.spec.ts`

## Execution

- [ ] T01 Write audit module unit tests T01-T05
  - Service: test
  - Files: `tests/admin-audit.test.ts`, `lib/admin-audit.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `node --import tsx --test tests/admin-audit.test.ts` fails red (stub `lib/admin-audit.ts` exports the plan's types and functions whose bodies throw `not implemented`) before T05; `npx tsc --noEmit -p .` exits 0
- [ ] T02 Extend login tests with audit cases T06-T10
  - Service: test
  - Files: `tests/admin-login.test.ts`
  - Deps: T01
  - Consumes: -
  - Produces: -
  - Verify: the `deps()` helper injects an `audit` spy (no console, no Mongo) in every existing and new call; `node --import tsx --test tests/admin-login.test.ts` — T06-T10 red before T06, every SF02 case still green
- [ ] T03 Write Mongo audit store test T11
  - Service: database
  - Files: `tests/admin-audit-mongo.test.ts`
  - Deps: T01
  - Consumes: -
  - Produces: -
  - Verify: `node --import tsx --test tests/admin-audit-mongo.test.ts` skips with no `MONGODB_DB` ending in `_e2e`; `$env:MONGODB_DB='retrokey_e2e'; node --env-file=.env.local --import tsx --test tests/admin-audit-mongo.test.ts` red before T05
- [ ] T04 Author audit E2E spec T12-T14
  - Service: test
  - Files: `e2e/audit.qa.spec.ts`
  - Deps: -
  - Consumes: -
  - Produces: -
  - Verify: `npx playwright test e2e/audit.qa.spec.ts --project=main` — T12 and T13 red before T06-T08 (no rows); `npx playwright test e2e/audit.qa.spec.ts --project=no-mongo` T14 green before and after (regression guard for RN03); the spec skips Mongo reads unless `MONGODB_DB` ends in `_e2e`
- [ ] T05 Implement audit module and Mongo store
  - Service: backend
  - Files: `lib/admin-audit.ts`
  - Deps: T01, T03
  - Consumes: -
  - Produces: `createAuditRecord(entry: AuditEntry, now: Date): AdminAuditRecord`, `recordAudit(entry: AuditEntry, deps?: AuditDeps): Promise<void>`, `auditAdminAction(admin: AdminIdentity, request: Request, action: AdminAction, target: AuditTarget, deps?: AuditDeps): Promise<void>`, `getMongoAuditStore(): Promise<AuditStore>`, `createMemoryAuditStore(): AuditStore & { records: AdminAuditRecord[] }`
  - Verify: `node --import tsx --test tests/admin-audit.test.ts` exits 0; `$env:MONGODB_DB='retrokey_e2e'; node --env-file=.env.local --import tsx --test tests/admin-audit-mongo.test.ts` exits 0 with T11 run (not skipped)
- [ ] T06 Audit every login outcome
  - Service: backend
  - Files: `lib/admin-login.ts`
  - Deps: T02, T05
  - Consumes: `recordAudit(entry: AuditEntry, deps?: AuditDeps): Promise<void>` (T05)
  - Produces: -
  - Verify: `npm test` exits 0 (T06-T10 green, SF02 tests unchanged and green); `npm run build` exits 0
- [ ] T07 Audit game create, update and delete
  - Service: backend
  - Files: `app/api/admin/games/route.ts`, `app/api/admin/games/[id]/route.ts`
  - Deps: T04, T05
  - Consumes: `auditAdminAction(admin: AdminIdentity, request: Request, action: AdminAction, target: AuditTarget, deps?: AuditDeps): Promise<void>` (T05)
  - Produces: -
  - Verify: `npm run build` exits 0; `npx playwright test e2e/audit.qa.spec.ts e2e/admin.qa.spec.ts e2e/rom-path.qa.spec.ts --project=main` green except T12 cartridge rows (until T08); guard line still first in each handler
- [ ] T08 Audit cartridge create, update and delete
  - Service: backend
  - Files: `app/api/admin/cartridges/route.ts`, `app/api/admin/cartridges/[id]/route.ts`
  - Deps: T04, T05
  - Consumes: `auditAdminAction(admin: AdminIdentity, request: Request, action: AdminAction, target: AuditTarget, deps?: AuditDeps): Promise<void>` (T05)
  - Produces: -
  - Verify: `npm run build` exits 0; delete `.next`, then `npx playwright test --project=main` green, then `npx playwright test --project=no-mongo` green (T14, SF01 T17, SF04 T09)

## Acceptance Checklist

- [ ] `lib/admin-audit.ts` exports one write function `recordAudit` that writes collection `admin_audit` (RF01, RF02)
- [ ] `createAuditRecord` builds the document from the fixed field list `user, action, targetType, targetId, at, ip` plus optional `usernameMatched: true` / `scope: 'ip'`; extra input keys never reach the document; `user` and `ip` have control characters removed and are cut to 64 chars (RN01, RF03)
- [ ] `recordAudit` writes `console.info('[audit] …', record)` before the insert, for every call (RN02)
- [ ] `recordAudit` never rejects; a store error or a timeout over `AUDIT_TIMEOUT_MS` (3000) logs `[audit] write failed` with the action and the error class name only (RN03)
- [ ] `getMongoAuditStore` creates indexes `{at:-1}` and `{targetType:1, targetId:1, at:-1}` once per instance, no TTL, no migration; an index error is logged, inserts continue and the next call retries the index (RF01, RF02)
- [ ] `authorizeAdmin` and `checkCredentialsLock` audit `login.success` (`user:'admin'`), `login.failure` and `login.locked` with `targetType:'login'`, `targetId:null`, `ip` from `getClientIp` (RF01, RF03, RF04)
- [ ] A typed username equal to the configured one is audited as `user:null, usernameMatched:true`; an IP lock as `user:null, scope:'ip'`; the configured username never appears in an audit entry (RF04, RN01)
- [ ] A rejected audit never changes the return value of `authorizeAdmin` or `checkCredentialsLock` (RN03)
- [ ] The 6 mutation handlers call `auditAdminAction(guard.admin, request, …)` on 2xx only, in the Mongo and in-memory branches, with the business `id` as `targetId` (RF02, RF03, RF04)
- [ ] `requireAdmin(request)` is still the first statement of every admin handler and no response status or body changed (RN03)

## Validation Gates

- [ ] Run `node --import tsx --test tests/auth-config.test.ts tests/r2-rom.test.ts tests/rooms-data.test.ts` and fix failures in files touched by this work
- [ ] Run `npm run build` and fix failures
