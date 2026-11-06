# Build ledger — feature: SF02-login-hardening — plan: docs/features/0001F-admin-secure-login/subfeatures/SF02-login-hardening/plan.md

Preflight: T07 produces hashPassword/verifyPasswordHash/verifyPlainPassword; T12 and T15 consume the same strings - match
Preflight: T08 produces resolveAdminCredentials/getAdminLoginHint/isProductionEnv; T12 and T16 consume the same strings - match
Preflight: T09 produces getClientIp(headers: Headers): string; T12 consumes it - match
Preflight: T10 produces throttleKey/peekLoginLock/registerLoginAttempt/clearLoginAttempts/getMongoAttemptStore; T12 consumes all five - match
Preflight: T12 produces authorizeAdmin/checkCredentialsLock; T13 consumes both - match
Preflight: T01-T06 test tasks - no Consumes/Produces, Files cover the test IDs - self-consistent
Preflight: T07-T10, T14 - Files cover each Produces, Deps name their red test task - self-consistent
Preflight: T11 - no interface, Verify names the CRITICAL impact report - self-consistent
Preflight: T12 - Deps T07-T11 cover every Consumes producer - self-consistent
Preflight: T13, T15, T16 - Deps cover every Consumes producer - self-consistent
Preflight: T13 and T16 both rely on e2e/login.qa.spec.ts (T06); no shared file edited twice - no conflict
Ruling: the coordinator implements tasks directly instead of one implementer subagent per task - it already holds the full plan, research and NextAuth findings from planning, and a cold agent would re-derive them; area validators stay independent - costs a self-review blind spot if wrong, mitigated by the per-area reviewer and the final review
