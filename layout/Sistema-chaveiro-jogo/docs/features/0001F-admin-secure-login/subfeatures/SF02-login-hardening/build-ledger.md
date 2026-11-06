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
T01: complete (commits a08a87dc..6161974a, BUILD_STATUS=pass via tsc --noEmit on a test-only batch, verify red for the right reason, validation at area end)
T02: complete (commits 6161974a..f3faa7ea, BUILD_STATUS=pass via tsc --noEmit on a test-only batch, verify red for the right reason, validation at area end)
T03: complete (commits f3faa7ea..6cc3f26b, BUILD_STATUS=pass via tsc --noEmit on a test-only batch, verify red for the right reason, validation at area end)
T04: complete (commits 6cc3f26b..80ea5089, BUILD_STATUS=pass via tsc --noEmit on a test-only batch, verify red for the right reason, validation at area end)
T05: complete (commits 80ea5089..d156dca9, BUILD_STATUS=pass via tsc --noEmit on a test-only batch, verify red for the right reason, validation at area end)
T06: complete (commits d156dca9..274318b8, BUILD_STATUS=pass via tsc --noEmit on a test-only batch, verify red for the right reason, validation at area end)
T07: complete (commits 274318b8..7ef59e1b, BUILD_STATUS=pass via tsc --noEmit (module not imported by the app yet), verify tests/password.test.ts 4/4, validation at area end)
Ruling: T08 also edits auth.ts with a minimal bridge (new credential result, constant-time compare, no expectedUsername log) although auth.ts belongs to T13 - the changed return type of resolveAdminCredentials would otherwise break the build between T08 and T13 - costs a double edit of authorize if wrong, T13 replaces the bridge
T08: complete (commits 7ef59e1b..9b7db1f5, BUILD_STATUS=pass via npm run build, verify tests/auth-config.test.ts 4/4, validation at area end)
test: validated (commits a08a87dc..274318b8, 2 violations, SPEC_STATUS=INCOMPLETE - T18 expected-username scan vs plan success log; E2E header must state ADMIN_PASSWORD matches ADMIN_PASSWORD_HASH)
Ruling: the success login log carries {id: admin, ip} and never the typed username, and T18 keeps scanning every log for the configured username - on success the typed name equals the configured one, which RN05 forbids in logs; SF03 audits success with the session id - costs SF03 losing the typed name on success if wrong, which equals the configured username anyway
test: fix round 1/3 (2 addressed, 0 open, 2 deferred; commits 9b7db1f5..bee94bb1)
test: minor (deferred): plan.md TL;DR does not mention the success-log identity ruling; it lives in Modules and the ledger
Ruling: a failure or locked log whose typed username equals the configured one logs {usernameMatched: true, ip} instead of the name, and T18 gains that case in T12 - RN05 forbids the configured username in logs even when an attacker typed it - costs SF03 an audit row without the typed name when it was the real one, which the configured value already identifies
T09: complete (commits bee94bb1..9220f4e3, BUILD_STATUS=pass via tsc --noEmit (module not imported by the app yet), verify tests/request-ip.test.ts 1/1, validation at area end)
T10: complete (commits 9220f4e3..df6e4522, BUILD_STATUS=pass via tsc --noEmit (module not imported by the app yet), verify tests/login-throttle.test.ts 5/5, Mongo pipeline unverified locally - MongoDB unreachable, validation at area end)
