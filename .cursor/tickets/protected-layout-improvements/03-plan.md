# Execution Plan: Protected Layout Improvements (Admin & Operator)

## 1. Thinking

### Layer Breakdown

The requirements touch five conceptual layers:

1. **DB** — Define `getInitialOrganization(userId)` in the db package. Returns `{ id, slug }` for the user's first org (e.g. first membership by createdAt). Use Drizzle `.prepare()` (preloading) for this hot query. db-agent owns this.

2. **Auth** — (a) Add `organizationClient()` to auth client. (b) Add `databaseHooks.session.create.before` that calls `getInitialOrganization(session.userId)` and sets `activeOrganizationId` and `activeOrganizationSlug` on the session. (c) Add `activeOrganizationSlug` to session `additionalFields` if not provided by the organization plugin. Auth-agent or server app configures hooks.

3. **Shared UI** — NavUser in `packages/ui` must be extended with props (`impersonated`, `onSignOut`, `onStopImpersonating`) so both apps can render context-dependent user nav without importing auth client. Sidebar base components stay as-is.

4. **Admin Frontend** — Auth gate change (non-admin sees role block screen instead of redirect to sign-in), app shell with sidebar (no TeamSwitcher), nav links (Users, Customers, Contracts, Machines), root layout adjustment so sidebar replaces header for `_admin` routes.

5. **Operator Frontend** — Auth gate (no org → redirect to /invitations), pending invitations page, `_protected.$orgSlug` dynamic routing. Org protection: compare URL orgSlug with `session.activeOrganizationSlug`; if mismatch, redirect to `/organizations`. Org selection page lists orgs, on select → `setActive({ organizationId, organizationSlug })` → redirect. App shell, handoff redirect.

6. **Tests** — Out of scope per user preference.

### Dependency Decisions

- **T02 (db-agent):** Create `getInitialOrganization(userId)` in db package using prepared statement (preloading). Required by T03 (auth hooks).

- **T03 (auth-agent):** Add `organizationClient()` to auth client. Add `databaseHooks.session.create.before` calling `getInitialOrganization`, setting `activeOrganizationId` and `activeOrganizationSlug`. Add `activeOrganizationSlug` to session `additionalFields`. Depends on T02. Required before T06 (operator) can use org APIs and session slug.

- **T04 (NavUser):** Extend NavUser with `onSignOut` (required) and optional `impersonated` + `onStopImpersonating` for operator only. Admin uses only `onSignOut`.

- **T05 (admin frontend):** Depends on T04 (uses NavUser). Independent of T06.

- **T06 (operator frontend):** Depends on T02, T03 (org APIs, session slug), T04 (NavUser). Includes org selection page and slug-mismatch redirect.

### Ambiguities Resolved

- **Better Auth org APIs:** `authClient.organization.list()` returns user's orgs. `authClient.organization.listUserInvitations()` returns pending invitations for the current user. Both are client-side. No tRPC needed.

- **Admin user nav:** Admin dashboard always shows "Sign out" only. No impersonation handling (per requirements).

- **Root layout:** The root has a header. For `_admin` and `_protected` routes, the layout will wrap content with SidebarProvider + sidebar + SidebarInset. The root can keep the header for non-protected routes (sign-in, handoff) or the layout itself provides the chrome. Decision: admin layout and operator layout each provide full app shell (sidebar + main); root stays minimal (Outlet only), and protected layouts replace the root header for their subtree. Alternatively: root keeps header for sign-in; `_admin` layout removes/replaces it with sidebar. Simpler: root renders Outlet; `_admin` layout is `SidebarProvider` > `AppSidebar` + `SidebarInset` > Outlet. Root header can remain for sign-in; for `_admin` routes the layout fills the main, so we may hide root header when inside _admin. Plan: root keeps current structure; `_admin` layout renders sidebar + content. If root header is redundant, frontend-agent can remove it for _admin routes or make layout full-bleed.

- **Handoff org slug resolution:** After OTT verify, call `organization.list()`, take `data[0]?.slug`, redirect to `/${slug}/dashboard`. If no org, redirect to `/invitations`.

- **Org slug mismatch:** When visiting `/:orgSlug/dashboard`, if `params.orgSlug !== session.activeOrganizationSlug`, redirect to `/organizations`. User picks org → `setActive({ organizationId, organizationSlug })` → redirect to `/${slug}/dashboard`.

- **Agent registry:** `.cursor/skills/agent-registry.md` was not found. Agents inferred from project conventions (auth-agent, frontend-agent, test-writer-agent, e2e-test-writer-agent, mutation-tester-agent, reviewer-agent).

---

## 2. Route Structure Diagrams

### Admin App

**Before:**
```
__root (header + main)
├── sign-in
└── _admin (beforeLoad: admin role check → redirect /sign-in)
    ├── index → redirect /dashboard
    ├── dashboard
    ├── users
    └── create-customer
```

**After:**
```
__root (header + main)
├── sign-in
└── _admin (beforeLoad: non-admin → role block screen; admin → allow)
    ├── index → redirect /dashboard
    ├── dashboard
    ├── users
    ├── customers          [NEW – placeholder]
    ├── contracts          [NEW – placeholder]
    ├── machines          [NEW – placeholder]
    └── create-customer
```

Layout: SidebarProvider + AdminAppSidebar + SidebarInset + Outlet.

---

### Operator App

**Before:**
```
__root (header + main)
├── sign-in
├── auth
│   └── handoff (?token) → verify → redirect /dashboard
└── _protected (beforeLoad: session check → redirect /sign-in)
    ├── index → redirect /dashboard
    └── dashboard
```

**After:**
```
__root (header + main)
├── sign-in
├── auth
│   └── handoff (?token) → verify → organization.list() → redirect /${slug}/dashboard (or /invitations if no org)
└── _protected (beforeLoad: session check → redirect /sign-in; org.list() empty → redirect /invitations)
    ├── invitations       [NEW – pending invitations page]
    ├── organizations     [NEW – org selection when URL slug ≠ session.activeOrganizationSlug]
    └── _protected.$orgSlug (layout; beforeLoad: orgSlug === session.activeOrganizationSlug else redirect /organizations; validate membership)
        ├── index → redirect /${orgSlug}/dashboard
        └── dashboard
```

Layout: SidebarProvider + OperatorAppSidebar + SidebarInset + Outlet.

---

## 3. Discovery Notes

### Better Auth Organization Client API

- **organization.list()** — Returns organizations the current user is a member of. Use to check if user has any org and to get first org slug for handoff redirect.
- **organization.listUserInvitations()** — Returns pending invitations for the current user (by session email). Use for /invitations page.
- **Auth client:** Currently has `adminClient()` and `oneTimeTokenClient()`. Must add `organizationClient()` from `better-auth/client/plugins` for operator app.

### Invitation Acceptance Flow

User can accept via `authClient.organization.acceptInvitation({ invitationId })`. The invitations page will list pending invitations and provide accept/reject actions.

### Session Active Organization

- **setActive:** `authClient.organization.setActive({ organizationId, organizationSlug })` updates the session's active org. Use after user selects org on selection page.
- **databaseHooks:** `session.create.before` runs when session is created; call `getInitialOrganization(userId)` and set `activeOrganizationId`, `activeOrganizationSlug`.
- **Preloading:** Use Drizzle `.prepare()` for `getInitialOrganization` — hot query on every session create (db-agent performance pattern).

---

## 4. Execution Order Table

*(Tests removed per user preference.)*

| Step | Task ID | Agent | Depends On | Parallel With |
|------|---------|-------|------------|---------------|
| 1 | T02 | db-agent | — | — |
| 2 | T03 | auth-agent | T02 | T04 |
| 2 | T04 | frontend-agent | — | T03 |
| 3 | T05 | frontend-agent | T04 | — |
| 3 | T06 | frontend-agent | T02, T03, T04 | — |

---

## 5. Per-Task Definitions

### T02 — getInitialOrganization Query (DB Package)

```
Task ID: T02
Agent: db-agent
Layer: Database
Description: Create getInitialOrganization(userId) in packages/db. Returns { id, slug } for the user's first organization (e.g. first membership by member.createdAt, joined with organization table for slug). Use Drizzle .prepare() for preloading (hot query on session create). Export from db package for auth to import.
Artifact: packages/db/src/queries/get-initial-organization.ts (or equivalent)
Skills needed: db-agent performance skill (Drizzle .prepare() for hot queries — see agent-stack database/performance.md), Supabase Postgres best practices
Commit message: feat(db): add getInitialOrganization query with prepared statement
Depends on: —
Risk: low
```

---

### T03 — Auth: organizationClient + databaseHooks + activeOrganizationSlug

```
Task ID: T03
Agent: auth-agent
Layer: Auth
Description: (1) Add organizationClient() to packages/auth/src/client.ts. (2) Add databaseHooks.session.create.before to Better Auth config (packages/auth or server): call getInitialOrganization(session.userId) from @slushomat/db, set activeOrganizationId and activeOrganizationSlug on session. (3) Add activeOrganizationSlug to session.additionalFields if not provided by organization plugin. (4) Ensure session table/type accepts activeOrganizationSlug (migration if needed).
Artifact: packages/auth/src/client.ts, packages/auth/src/index.ts (or server auth config)
Skills needed: Better Auth organization plugin, databaseHooks
Commit message: feat(auth): add org client, session hooks for active org id+slug, additionalFields
Depends on: T02
Risk: low
```

---

### T04 — Extend NavUser Component

```
Task ID: T04
Agent: frontend-agent
Layer: Shared UI (packages/ui)
Description: Extend NavUser to accept impersonated (boolean), onSignOut, and onStopImpersonating props. When impersonated=true, show "Stop impersonating" and call onStopImpersonating on click. Otherwise show "Sign out" and call onSignOut. Remove hardcoded "Log out". Do NOT import auth client — callbacks are passed from parent.
Artifact: packages/ui/src/base/nav-user.tsx
Skills needed: frontend-design, Shadcn patterns
Commit message: feat(ui): extend NavUser with impersonation-aware sign out / stop impersonating
Depends on: —
Risk: low
```

---

### T05 — Admin App: Auth Gate, App Shell, Routes

```
Task ID: T05
Agent: frontend-agent
Layer: Frontend (admin)
Description: (1) Change _admin beforeLoad: if session exists but user.role !== "admin", do NOT redirect to sign-in; render a dedicated "role needs update" screen (static message). (2) Create admin-specific app shell (AdminAppSidebar) in apps/admin-frontend composing Sidebar, SidebarContent, SidebarFooter from packages/ui. No TeamSwitcher. (3) Add NavMain items: Users, Customers, Contracts, Machines. (4) Add placeholder routes: customers, contracts, machines. (5) Use NavUser in footer with onSignOut only (admin always shows "Sign out"; no impersonation). (6) Root layout: for _admin routes, sidebar replaces or complements header (sidebar + main content).
Artifact: apps/admin-frontend/src/routes/_admin/route.tsx, apps/admin-frontend/src/components/admin-app-sidebar.tsx, apps/admin-frontend/src/routes/_admin/customers.tsx, contracts.tsx, machines.tsx, apps/admin-frontend/src/routes/role-block.tsx (or inline)
Skills needed: frontend-design, TanStack Router, Shadcn sidebar
Commit message: feat(admin): add sidebar app shell, role block screen, nav links (Users, Customers, Contracts, Machines)
Depends on: T04
Risk: medium
```

---

### T06 — Operator App: Auth Gate, Invitations, Org Slug Routing, Shell, Handoff

```
Task ID: T06
Agent: frontend-agent
Layer: Frontend (operator)
Description: (1) In _protected beforeLoad: after session check, call authClient.organization.list(). If empty, redirect to /invitations (unless already on /invitations). (2) Create /invitations route with pending invitations page using authClient.organization.listUserInvitations(). List invitations with accept/reject. (3) Create /organizations route (org selection page): lists user's orgs via organization.list(); on select, call authClient.organization.setActive({ organizationId, organizationSlug }) then redirect to /${organizationSlug}/dashboard. (4) Create _protected.$orgSlug layout with beforeLoad: if params.orgSlug !== session.activeOrganizationSlug, redirect to /organizations; else validate membership. (5) Move dashboard and index under _protected.$orgSlug. (6) Create operator-specific app shell (OperatorAppSidebar). (7) Use NavUser with impersonation handling. (8) Update auth/handoff: after OTT verify, call organization.list(), take first org slug, redirect to /${slug}/dashboard; if no org, redirect to /invitations.
Artifact: apps/operator-frontend/src/routes/_protected/route.tsx, apps/operator-frontend/src/routes/_protected/invitations.tsx, apps/operator-frontend/src/routes/_protected/organizations.tsx, apps/operator-frontend/src/routes/_protected.$orgSlug/route.tsx, apps/operator-frontend/src/routes/_protected.$orgSlug/dashboard.tsx, apps/operator-frontend/src/routes/_protected.$orgSlug/index.tsx, apps/operator-frontend/src/components/operator-app-sidebar.tsx, apps/operator-frontend/src/routes/auth/handoff.tsx
Skills needed: frontend-design, TanStack Router, Better Auth organization API
Commit message: feat(operator): add org gate, invitations, org selection page, org-slug routing, sidebar shell, handoff redirect
Depends on: T03, T04
Risk: high (routing restructure, multiple flows)
```

---

## 6. Parallel Groups

- **Step 1:** T02 (db-agent) runs first — creates getInitialOrganization query.

- **Group 2 (Step 2):** T03 (auth-agent) and T04 (frontend-agent) run in parallel. T03 depends on T02.

- **Group 3 (Step 3):** T05 (admin frontend) and T06 (operator frontend) run in parallel once T03 and T04 are done. T05 depends only on T04. T06 depends on T02, T03, and T04.

---

## 7. Out of Scope

- **Tests** — Unit, integration, E2E, and mutation tests for this feature (per user preference).
- **TeamSwitcher in sidebar** — Org selection is a full-page flow (`/organizations`) when URL slug ≠ session slug, not a sidebar dropdown.
- **Self-service admin role upgrade** — Role block screen is static; no flow to request or grant admin.
- **Custom tRPC for invitations** — Better Auth `organization.listUserInvitations()` is used directly from client.
- **Root layout removal** — Root keeps Outlet; layouts provide chrome. Frontend-agent may refine (e.g. hide root header for protected routes) as implementation detail.
- **E2E for role block screen** — Covered by IT-01; E2E can be added if desired.

---

## 8. Invisible Knowledge

**System rationale:** Using Better Auth's native organization client APIs avoids custom tRPC and keeps auth logic in auth layer. Sidebar composition in each app (rather than a shared app-sidebar import) ensures app-specific nav and layout without over-abstraction. NavUser callback pattern keeps UI package free of auth coupling.

**Invariants:**
- Session has `impersonatedBy` when impersonating; NavUser uses it to switch label/action.
- Session has `activeOrganizationId` and `activeOrganizationSlug` (set via databaseHooks on create; updated via setActive).
- Organization slug is unique; used for URL and membership validation.
- Handoff OTT is single-use; after verify, session is set and org list is available.
- Admin app does not use org context; operator app is org-scoped.
- `getInitialOrganization` uses prepared statement (preloading) — hot path on session create.

**Accepted trade-offs:**
- Root layout keeps header for sign-in/handoff; protected layouts add sidebar. Possible visual overlap — frontend-agent resolves during impl.
- Invitations page lists all pending; no pagination in initial scope.
- Org slug validation may require fetching org by slug and checking membership; no server-side route guard—beforeLoad runs client-side with org.list() or a membership check.
- Auth client is shared; organizationClient is added even though only operator app uses it (admin may use org APIs later).

**Rejected alternatives:**
- **Shared app-sidebar in packages/ui:** Each app has different nav; reference app-sidebar is for demo only.
- **tRPC org.list bridge:** Better Auth client already exposes organization.list(); no server round-trip needed.
- **Redirect non-admin to sign-in:** Requirements explicitly want role block screen (user stays signed in).
- **Server-side org validation middleware:** TanStack Router beforeLoad is client-side; we validate via org.list() and slug match. Server-side would require API; current approach is sufficient for single-org operator model.
