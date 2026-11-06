# Past Features Analysis: 0002F-emulator-themes-controls

Scope: docs/features/ contains only 0001F-admin-secure-login and 0002F (this feature). docs/delivered.jsonl was not re-read in this run; 0001F/past-features.md records it as having no entries. Phase 1.5 was run by hand, not by the changelog script.

## Related Features

| id | relation | why |
|---|---|---|
| 0001F-SF01-admin-api-guard (done per docs/features/0001F-admin-secure-login/epic.md:19) | depends_on | Admin writes for themes and controls must go through requireAdmin (lib/auth-guard.ts:62-79). It is already applied to the 10 `/api/admin/*` handlers (games/route.ts:9,22; games/[id]/route.ts:9,33,109; cartridges/route.ts:7,20; cartridges/[id]/route.ts:7,24,53). middleware.ts:19 matcher `/admin/:path*` redirects only. |
| 0001F-SF03-admin-audit-trail (pending, epic.md:21) | depends_on (soft) | Theme and control writes are admin mutations. SF03 is meant to audit create/edit/delete into admin_audit. The new admin endpoints should call the audit hook once SF03 lands, or be listed as an explicit exclusion. |
| 0001F-SF04-rom-path-containment (pending, epic.md:22) | conflicts | SF04 edits the same handlers as SF01 (app/api/admin/games/route.ts, games/[id]/route.ts) and changes `/api/rom/[slug]` (app/api/rom/[slug]/route.ts:121, public/<romPath>). This feature touches the same game admin handlers and may add theme image paths under public/. Both must be merged in order. |
| 0001F-SF02-login-hardening (done, epic.md:20) | shares-pattern | Same admin client helper lib/admin-api.ts (getAdminAuthStatus, ADMIN_LOGIN_URL) used by every admin tab. The new tab must reuse it. |
| 0001F (epic, discovery) | depends_on | discovery.md:76 states that `/api/rom/[slug]` must stay anonymous because the emulator iframe loads it without a session. The new anonymous play-config read must follow the same rule. |

## Matches

### 0001F-admin-secure-login (depends_on, shares-pattern)
- Domain: admin, auth, api
- Shared files: `lib/auth-guard.ts`, `lib/admin-api.ts`, `app/admin/page.tsx`, `components/admin/GamesTab.tsx`, `app/api/admin/games/route.ts`, `app/api/admin/games/[id]/route.ts`
- Patterns used: requireAdmin as first statement in each handler; 401/403 detected by status (getAdminAuthStatus); onAuthError prop from the page to each tab; the middleware redirects pages and the handlers are the barrier (RN01)
- Key decisions: the guard decides from the signed JWT only, without MongoDB (auth-guard.ts:5-6); `role === 'admin'` is set in auth.config.ts:27
- Iterations summary: 0001F SF01 and SF02 done (epic.md:19-20); SF03 and SF04 pending
- Relevance: this feature cannot ship its admin editors without the guard. The guard is in place on HEAD, but main (fe282828) is not an ancestor of the branch, so 0002F must branch after 0001F merges as the about.md states.

## No Match
- None. The only other feature directory is this one.

## Metadata
{"updated":"2026-11-06","feature":"0002F-emulator-themes-controls","matches":4,"total_analyzed":1,"by":"discovery-agent"}
