# Execution Plan: Admin Impersonation Handoff to Operator Dashboard

## 1. Thinking

### Layer breakdown

The feature touches three layers:

1. **Auth** — The one-time token (OTT) plugin must be added to Better Auth (server and client). The admin plugin with `impersonateUser` / `stopImpersonating` already exists (`packages/auth/src/index.ts` has `admin()`). The OTT plugin enables cross-domain session handoff: generate on admin domain, verify on operator domain. No changes to impersonation itself.

2. **Admin frontend** — Users page at `/users`; fetch users via `authClient.admin.listUsers`. Each row: "Open as user" button. Flow: impersonateUser → oneTimeToken.generate → open new tab → stopImpersonating. Needs VITE_OPERATOR_URL.


3. **Operator frontend** — Handoff page at `/auth/handoff` that reads the token from the query, calls `oneTimeToken.verify`, and redirects to `/dashboard` on success. Error handling for invalid/expired tokens.

### Dependency decisions

- **T01 (auth) → T02, T03**: Both frontends need `oneTimeTokenClient()` on `authClient` before the flow works. T01 is foundational.

- **T02 and T03** depend only on T01. Use `authClient.admin.listUsers` for user listing — no custom API.

- **T02 and T03** can run in parallel after T01.

### Ambiguities resolved

- **User listing API**: Use `authClient.admin.listUsers` from the Better Auth admin plugin — no custom tRPC needed.
- **OTT plugin location**: Shared auth client (`packages/auth/src/client.ts`) is used by both admin and operator; adding `oneTimeTokenClient()` there covers both.
- **Operator URL**: `VITE_OPERATOR_URL` is added to the web env schema (optional for admin-frontend). Same value as `CORS_ORIGIN_OPERATOR` in dev/prod.
- **Handoff route layout**: `/auth/handoff` sits outside the protected layout (no session until OTT verify succeeds).
- **Tests skipped**: Per user request, no test-writer, e2e-test-writer, or mutation-tester tasks.

---

## 2. Execution Order Table

| Step | Task ID | Agent | Depends On | Parallel With |
|------|---------|-------|------------|---------------|
| 1 | T01 | auth-agent | — | — |
| 2 | T02 | frontend-agent | T01 | T03 |
| 2 | T03 | frontend-agent | T01 | T02 |

---

## 3. Per-Task Definitions

### T01 — Add One-Time Token Plugin to Better Auth

**Task ID:** T01  
**Agent:** auth-agent  
**Layer:** Auth  

**Description:** Add the Better Auth one-time token plugin on the server and client so the impersonation handoff can pass the session across domains.

- **Server:** Add `oneTimeToken()` from `better-auth/plugins/one-time-token` to `packages/auth/src/index.ts`.
- **Client:** Add `oneTimeTokenClient()` from `better-auth/client/plugins` to `packages/auth/src/client.ts`.

Use default `expiresIn` (3 minutes). `trustedOrigins` already includes `CORS_ORIGIN_ADMIN` and `CORS_ORIGIN_OPERATOR`.

**Artifact:** `packages/auth/src/index.ts`, `packages/auth/src/client.ts`

**Skills needed:** Better Auth docs (one-time-token plugin)

**Commit message:** `feat(auth): add one-time token plugin for cross-domain handoff`

**Depends on:** —

**Risk:** low

---

### T02 — Admin Users Page with "Open as user" Button

**Task ID:** T02  
**Agent:** frontend-agent  
**Layer:** Frontend (admin)  

**Description:** Implement the Users page and impersonation handoff flow.

1. **Env:** Add `VITE_OPERATOR_URL` (optional) to `packages/env/src/web.ts` and document in admin-frontend `.env.example` that it should match `CORS_ORIGIN_OPERATOR`.
2. **Route:** Create `/users` under `_admin` layout.
3. **Page:** Table of users from `authClient.admin.listUsers({ query: { limit, offset, sortBy, sortDirection } })`. Use TanStack Query to wrap the call. Each row: user info + “Open as user” button.
4. **Flow:** On click: (a) `authClient.admin.impersonateUser({ userId })`, (b) `authClient.oneTimeToken.generate()`, (c) `window.open(\`${VITE_OPERATOR_URL}/auth/handoff?token=${token}\`)`, (d) `authClient.admin.stopImpersonating()`.
5. **States:** Idle, loading (button disabled + spinner), error (toast). Per 01-ui-spec.
6. **Entry:** Add Users link from admin dashboard or nav.

**Artifact:** `packages/env/src/web.ts`, `apps/admin-frontend/src/routes/_admin/users.tsx`, dashboard/nav updates, `.env.example` if present

**Skills needed:** frontend-design, 01-ui-spec.md

**Commit message:** `feat(admin): add Users page with Open as user impersonation handoff`

**Depends on:** T01

**Risk:** medium (multi-step async flow)

---

### T03 — Operator Handoff Page

**Task ID:** T03  
**Agent:** frontend-agent  
**Layer:** Frontend (operator)  

**Description:** Implement the handoff page that exchanges the one-time token for a session.

1. **Route:** Create `/auth/handoff` (outside protected layout).
2. **Logic:** Read `token` from query params. If missing → redirect to `/sign-in`. If present → call `authClient.oneTimeToken.verify({ token })`.
3. **Success:** Redirect to `/dashboard` (operator dashboard).
4. **Error:** Show “This link has expired or is invalid” with “Go to sign in” button to `/sign-in`.
5. **Loading:** Show “Signing in...” + spinner while verifying.

**Artifact:** `apps/operator-frontend/src/routes/auth/handoff.tsx` (or equivalent route structure)

**Skills needed:** frontend-design, 01-ui-spec.md

**Commit message:** `feat(operator): add /auth/handoff page for impersonation session handoff`

**Depends on:** T01

**Risk:** low

---

## 4. Parallel Groups

- **Group 1:** T01 (auth-agent) runs first — foundational for OTT client.
- **Group 2:** T02 (admin Users page) and T03 (operator handoff page) can run in parallel once T01 is done — no dependency between T02 and T03.

---

## 5. Out of Scope

- **Server-side Redis handoff** — Alternative flow where the admin tab never loses the admin session. Requires Redis/KV and custom backend endpoint. Rejected for initial implementation.
- **Impersonating admin users** — Requires `impersonate-admins` permission; not in scope.
- **Audit log UI** — Session has `impersonatedBy` for audit; no UI to view logs.
- **Unit, integration, and E2E tests** — Skipped per user request.
- **Mutation testing and reviewer-agent** — Skipped per user request.

---

## 6. Invisible Knowledge

**System rationale:** Using the Better Auth one-time token plugin avoids Redis and custom backend handoff logic. The client-side flow briefly replaces the admin session in the admin tab; `stopImpersonating` restores it after opening the new tab. OTT is single-use and short-lived (3 min default), so the handoff link is safe to use once.

**Invariants:**
- Admin and operator share one auth backend (`BETTER_AUTH_URL`). CORS `trustedOrigins` includes both `CORS_ORIGIN_ADMIN` and `CORS_ORIGIN_OPERATOR`.
- Impersonation sessions use `impersonatedBy` for audit.
- OTT verify consumes the token (one-time use). PR #3659 sets the session cookie on verify.
- Admin-only access is enforced by `adminProcedure` and `_admin` route guard.

**Accepted trade-offs:**
- Admin tab briefly loses admin session during `impersonateUser` → `generate` → `stopImpersonating`. Acceptable for initial implementation.
- Token in URL for handoff — required for cross-domain redirect; OTT is short-lived and single-use.
- `VITE_OPERATOR_URL` must be configured for admin-frontend; mismatches cause wrong redirects (config issue, not in-scope to solve in code).

**Rejected alternatives:**
- **Server-side Redis handoff:** Avoids replacing the admin session but adds Redis and custom endpoints. Deferred unless product explicitly requests it.
- **Custom handoff API:** Better Auth OTT plugin provides generate/verify; no custom API needed.
- **Custom tRPC admin.listUsers:** Better Auth admin plugin already exposes `authClient.admin.listUsers`; no custom procedure needed.
