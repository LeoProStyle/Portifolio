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
T11: complete (commits df6e4522..c84aea56, BUILD_STATUS=pass via npm run build, npm test 37/45 with the 8 red ones owned by T12/T14/T15, GitNexus impact getMongoClient CRITICAL 13 flows reported before the edit, validation at area end)
T12: complete (commits c84aea56..b7db0500, BUILD_STATUS=pass via tsc --noEmit (wired into the app in T13), verify tests/admin-login.test.ts 6/6, validation at area end)
T13: complete (commits b7db0500..0a605fd1, BUILD_STATUS=pass via npm run build, verify e2e/admin.qa.spec.ts --project=main 11/11 with real login through authorizeAdmin, validation at area end)
T14: complete (commits 0a605fd1..3b7e6bc8, BUILD_STATUS=pass via npm run build (edge middleware compiled), verify tests/admin-session.test.ts 1/1 and e2e/admin.qa.spec.ts --project=main 11/11, validation at area end)
T15: complete (commits 3b7e6bc8..e3d8b3f7, BUILD_STATUS=pass via tsc --noEmit (script is outside the app bundle), verify tests/hash-script.test.ts 2/2, .env.example holds names only, validation at area end)
T16: complete (commits e3d8b3f7..89b76f74, BUILD_STATUS=pass via npm run build, verify e2e/login.qa.spec.ts --project=main T22 green, T23 skipped with annotation - MongoDB unreachable on this machine, validation at area end)
frontend: validated (commits e3d8b3f7..89b76f74, 0 blocking violations, 2 minor, SPEC_STATUS=COMPLETE with RF04 429 half proven by static read until T23 runs on MongoDB)
frontend: minor (deferred): a 429 without a JSON url body (platform or proxy) makes next-auth signIn throw and the form shows Erro inesperado instead of the generic message; the app 429 always carries url
frontend: minor (deferred): T23 (429 end to end) skipped locally - MongoDB unreachable; run e2e/login.qa.spec.ts --project=main with MongoDB reachable before merge
backend: validated (commits 274318b8..e3d8b3f7, 3 minor violations, SPEC_STATUS=COMPLETE, npm test 45/45)
Ruling: F2 (duplicate or JSON username skips the 429 pre-check) accepted and recorded in plan Risks - authorizeAdmin still counts the attempt with the name NextAuth parsed, so the 5-check cap holds - costs an attacker seeing CredentialsSignin instead of 429 if wrong
Ruling: F3 (rotating usernames buys 5 scrypt runs per name from one IP) accepted for SF02 and recorded in plan Risks; a coarse per-IP counter is a future improvement - the spec keys the throttle on username+IP and the real admin key stays capped - costs CPU and Mongo load under a username-rotation flood if wrong
backend: fix round 1/3 (3 addressed, 0 open, 2 deferred as accepted risks; commits 89b76f74..2f93c9d5)
e2e: deferred to the last subfeature (epic; SF02 declares no QA/E2E Specification rows - no design.md)
Final review findings: FR-1 unverified Mongo store and 429 path (feature, major); FR-2 usingDefaults half-config (feature, minor); FR-3 unbounded logged username (feature, minor); FR-4 shared unknown IP key off Vercel (feature, minor); FR-5 E2E Mongo probe uses the real admin (feature, minor); FR-6 readline private method in the hash prompt (feature, minor); FR-7 middleware MissingSecret wording (feature, minor); FR-8 username-rotation amplification, no IP cap (owasp, major); FR-9 scrypt cost below OWASP minimum (owasp, minor); FR-10 NODE_ENV fail-open (owasp, minor); FR-11 logged username unbounded (owasp, minor, same as FR-3); FR-12 Mongo pipeline never run live (owasp, minor, same as FR-1); FR-13 open redirect on callbackUrl, pre-existing (owasp, deferred minor); FR-14 stateless JWT not revoked by password rotation (owasp, informational)
Ruling: FR-2 judged a partial misread - with ADMIN_PASSWORD set and ADMIN_USERNAME unset the plain branch already returns usingDefaults false; both half-configured cases are now pinned in T08 instead of changing code - costs a misleading dev hint if wrong, development only
Ruling: FR-5 kept as is - the E2E module-level throw matches the SF01 spec, the ADMIN_PASSWORD/ADMIN_PASSWORD_HASH pairing is documented in the spec header, and the probe only counts a failure when MongoDB is reachable - costs a 15-minute local lockout of the owner key if wrong
Ruling: FR-6 kept the private readline override, now documented in the script; the TTY path has no automated test and needs one manual run - costs the password echoing to stderr in a terminal after a Node upgrade if wrong
Ruling: FR-14 informational - rotating ADMIN_PASSWORD_HASH does not revoke live sessions, only AUTH_SECRET rotation does; the absolute 8h limit bounds the exposure - costs up to 8h of a stolen session surviving a password change if wrong
Ruling: FR-1/FR-12 cannot be closed on this machine (MongoDB unreachable) - tests/login-throttle-mongo.test.ts now runs the policy and a 10-parallel burst against the real store and skips without a database; T23 and that test must run with MongoDB reachable before merge - costs every production login failing closed on the first deploy if the pipeline is wrong
final-review: fix round 1/3 (12 addressed, 1 open - FR-13 callbackUrl bypass via tab; commits f6b292ab..debb7697)
