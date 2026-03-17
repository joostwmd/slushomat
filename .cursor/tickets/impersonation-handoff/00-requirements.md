# Requirements: Admin Impersonation Handoff to Operator Dashboard

## Summary

An admin must be able to impersonate a user (operator) from the admin dashboard and open the operator dashboard in a new tab with that user's session — without duplicating UI or business logic. Admin and operator dashboards are deployed on different domains (e.g. `admin.slushomat.com` and `operator.slushomat.com`) and share a single backend. The solution uses Better Auth's **admin plugin** (impersonation) and **one-time token (OTT) plugin** (cross-domain session handoff).

## Actors

- **Primary**: Admin (user with `role: "admin"`). Authorization is enforced by the admin route/procedure layer.
- **Secondary**: Operator (the impersonated user) — the session is created for them; they receive no notification.

## Context: Why Cross-Domain Handoff?

Cookies are domain-scoped. A session cookie set on `admin.slushomat.com` is not sent to `operator.slushomat.com`. To open the operator dashboard as the impersonated user, we need to pass the session from the admin domain to the operator domain via a short-lived, one-time token in the URL.

## Technical Approach

### Better Auth Stack

- **Admin plugin** (`auth.api.impersonateUser`, `auth.api.stopImpersonating`) — creates/ends impersonation sessions with `impersonatedBy` for audit.
- **One-time token plugin** (`authClient.oneTimeToken.generate`, `authClient.oneTimeToken.verify`) — generates a token tied to the current session; verify exchanges it for a session cookie (PR #3659: sets cookie automatically).
- Single shared auth backend at `BETTER_AUTH_URL` (e.g. `api.slushomat.com`). Both admin and operator frontends call the same auth routes.

### Flow (Client-Side, OTT-Native)

1. Admin clicks "Open as [user]" in the admin dashboard.
2. **Client** calls `authClient.admin.impersonateUser({ userId })` — impersonation session is created; admin tab briefly has impersonated session cookie.
3. **Client** calls `authClient.oneTimeToken.generate()` — OTT is generated for that session.
4. **Client** opens `operator.slushomat.com/auth/handoff?token={OTT}` in a new tab.
5. **Client** calls `authClient.admin.stopImpersonating()` — admin tab reverts to admin session.
6. **Operator handoff page** loads; calls `authClient.oneTimeToken.verify({ token })` — token is validated, consumed, and session cookie is set on the operator domain.
7. Operator dashboard loads with the impersonated session; no UI or logic duplication.

### Alternative: Server-Side Endpoint (No Session Replacement)

If the product requires that the admin tab *never* loses the admin session, a custom backend endpoint can be implemented:

- Admin calls `POST /api/admin/impersonate-handoff` with `{ userId }`.
- Backend: (a) verifies admin session, (b) calls `auth.api.impersonateUser` to create impersonation session, (c) stores `session.token` in Redis with a handoff token (TTL 30s, one-time use), (d) returns `{ handoffToken }`.
- Admin opens `operator.slushomat.com/auth/handoff?token={handoffToken}`.
- Operator backend: validates handoff token, sets session cookie manually.

This requires Redis or similar KV store and is out of scope for the initial implementation unless explicitly requested.

## Data Requirements

### Impersonate User

| Field   | Required | Notes                                      |
|---------|----------|--------------------------------------------|
| userId  | Yes      | ID of the operator to impersonate          |

**API**: `authClient.admin.impersonateUser({ userId })`

Returns: `{ session: { token, expiresAt, userId, impersonatedBy, id }, user: { ... } }`

### Generate One-Time Token

**API**: `authClient.oneTimeToken.generate()`

- Requires active session (impersonated session, set by step 1).
- Returns: `{ token: string }`
- Default TTL: 3 minutes (configurable via `oneTimeToken({ expiresIn })`).

### Verify One-Time Token

**API**: `authClient.oneTimeToken.verify({ token })`

- Consumes the token (one-time use).
- Sets session cookie in response (per Better Auth PR #3659).
- Returns session data.

## Flow

### Happy Path

1. Admin is on a user/operator list or detail view.
2. Admin clicks "Open as user" / "View operator dashboard" for a target user.
3. Loading state: button disabled, "Opening..." or spinner.
4. New tab opens to operator dashboard with impersonated session.
5. Admin tab remains on admin dashboard with admin session restored.
6. Operator tab shows operator dashboard as the impersonated user.

### Edge Cases

**Given** the impersonation or OTT generate fails (e.g. user not found, network error)  
**When** the admin clicks "Open as user"  
**Then** an error message is displayed. Admin session is unchanged. No new tab opens.

**Given** the handoff token is expired or already used  
**When** the operator handoff page loads with the token  
**Then** an error state is shown (e.g. "Link expired or invalid") with a link back to operator sign-in.

**Given** the admin attempts to impersonate another admin (without `impersonate-admins` permission)  
**When** the impersonation API is called  
**Then** the API returns an error (403) and the error is displayed.

**Given** the operator handoff page is loaded without a token  
**When** the page renders  
**Then** it redirects to operator sign-in or dashboard (no token = invalid access).

### Failure States

**Given** the admin is not authenticated or session expired  
**When** they attempt the impersonation flow  
**Then** they are redirected to admin sign-in (existing auth guard).

**Given** the OTT verify fails (network, invalid token)  
**When** the operator handoff page attempts verify  
**Then** an error message is shown. User can retry or go to sign-in.

**Given** the operator dashboard URL is misconfigured (wrong domain)  
**When** the admin clicks "Open as user"  
**Then** the new tab opens to the wrong URL. Configuration fix required (out of scope for this ticket).

## Acceptance Criteria

### Happy Path (AC-1)

**Given** an admin is authenticated and viewing a user/operator  
**When** they click "Open as user" and the flow completes  
**Then** a new tab opens to the operator dashboard, the operator dashboard shows the impersonated user's context, and the admin tab retains the admin session.

### Impersonation Session and Audit (AC-2)

**Given** an impersonation session is created  
**When** the session is stored  
**Then** it has `impersonatedBy` set to the admin's user ID. Impersonation sessions expire per `impersonationSessionDuration` (default 1 hour).

### Error Handling (AC-3)

**Given** impersonation or OTT generation fails  
**When** the admin clicks "Open as user"  
**Then** an error message is displayed, no new tab opens, and the admin session is preserved.

### Handoff Page Error (AC-4)

**Given** the operator handoff page receives an invalid, expired, or already-used token  
**When** the page loads  
**Then** an error message is shown and the user can navigate to operator sign-in.

### Security (AC-5)

**Given** a non-admin user (or unauthenticated user)  
**When** they attempt to trigger the impersonation flow  
**Then** the request is rejected with 401/403. Better Auth admin plugin enforces this.

## Constraints

- **Better Auth native**: Use `oneTimeToken` plugin; no custom Redis handoff for initial implementation unless product explicitly requests it.
- **Single backend**: Admin and operator share the same auth backend (`BETTER_AUTH_URL`). CORS origins include both `CORS_ORIGIN_ADMIN` and `CORS_ORIGIN_OPERATOR`.
- **Impersonation duration**: Per existing admin dashboard requirements, impersonation sessions auto-expire after 1 hour (`impersonationSessionDuration`).

## Out of Scope

- Server-side impersonation handoff with Redis (alternative approach; can be added later).
- Impersonation from within the operator dashboard (admin-only feature).
- Audit log UI for impersonation events (session has `impersonatedBy`; logging can be added separately).
- Impersonating admin users (requires `impersonate-admins` permission; not in initial scope).

## Open Questions

- None — all resolved.

## Notes

- **Entry point**: A **Users page** (`/users`) lists all users. Each row has an "Open as user" button that triggers the impersonation handoff for that user. No separate user detail page is required for the initial implementation.
- **Operator dashboard URL**: Use `CORS_ORIGIN_OPERATOR` — it is the operator dashboard URL (e.g. `http://localhost:3003` in dev). The admin frontend needs this value to build the handoff URL; expose it via `VITE_OPERATOR_URL` or similar in admin-frontend's env, set to the same value as `CORS_ORIGIN_OPERATOR`.
- The client-side flow briefly replaces the admin session with the impersonated session. `stopImpersonating` restores it immediately after opening the new tab. This is acceptable for the initial implementation.
- Better Auth OTT plugin: `expiresIn` defaults to 3 minutes. For handoff, 1–3 minutes is sufficient (user clicks and tab opens within seconds).
