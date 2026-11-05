# Past Features — 0001F-admin-secure-login

## Related Features
None. `docs/features/` was empty before this feature (FEATURES:count=0), `docs/delivered.jsonl` has no entries (MATCHED_LIVE=0, MATCHED_DEAD=0), and the docs graph returned no work item for `middleware.ts`, `auth.ts`, `lib/auth-config.ts`, `components/login/LoginForm.tsx`, `app/api/admin/games/route.ts`, `app/api/rom/[slug]/route.ts`.

## Knowledge base pages covering the touched files
| page | freshness | why |
|---|---|---|
| .codeadd/wiki/domains/backend.md | fresh (commit 17bd8acf = HEAD) | auth, admin route protection, ROM delivery |
| .codeadd/wiki/domains/frontend.md | fresh | client session gating of /admin, LoginForm |
| .codeadd/wiki/conventions.md | fresh | error-response, env-var and log conventions |
| .codeadd/wiki/architecture.md | fresh | layer rules, boundaries |
