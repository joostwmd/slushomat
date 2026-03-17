# Requirements: Protected Layout Improvements (Admin & Operator)

## Summary

Improve the protected layouts of both the admin and operator frontend apps with proper auth gates, Shadcn sidebar app shells, org-aware routing (operator), and context-dependent user nav (operator only: impersonation vs sign out).

## Tech Stack Context

- **Stack:** Supabase, Drizzle, Better Auth, Hono, tRPC, React, TanStack Router, Shadcn, TypeScript
- **Auth:** Better Auth with admin plugin (impersonation), organization plugin, one-time token plugin
- **Schema:** User has `role` (admin | member | etc). Session has `impersonatedBy`, `activeOrganizationId`, `activeOrganizationSlug`. Organization has `slug`. Member links user to org. Invitation has `email`, `status`, `organizationId`.

## Current State

- **Admin app** (`apps/admin-frontend`): `_admin` layout checks `session.data.user.role === "admin"` in beforeLoad; if not admin, redirects to `/sign-in`. Layout is a plain div. Routes: `_admin/dashboard`, `_admin/users`, `_admin/create-customer`.
- **Operator app** (`apps/operator-frontend`): `_protected` layout only checks `session.data`; no org membership check. Layout is a plain div. Routes: `_protected/dashboard`, `_protected/index`, `auth/handoff`.
- **packages/ui:** Base `sidebar.tsx`, `app-sidebar.tsx` (reference with TeamSwitcher, NavMain, NavProjects, NavUser), `nav-user.tsx`, etc. App-sidebar uses hardcoded sample data.

## Requirements

### 1. Admin App – Protected Layout

#### 1.1 Auth Gate
- A signed-in user **without** `role === "admin"` must NOT access the dashboard.
- Instead of redirecting to sign-in, show a dedicated **"role needs update"** screen explaining their role must be updated to admin first (user is blocked, not logged out).
- Messaging: Static (e.g. "Your account does not have admin access. Contact your administrator to request admin privileges."). No self-service role upgrade flow.

#### 1.2 App Shell
- Use Shadcn sidebar (base components in `packages/ui`).
- Create an **admin-specific** app shell in `apps/admin-frontend` that composes base Sidebar, SidebarContent, SidebarFooter, etc.
- Do NOT use TeamSwitcher (no org switcher; admin does not use orgs in the same way).

#### 1.3 Nav Links
- Add links and routes for: **Users**, **Customers**, **Contracts**, **Machines**.
- Placeholder pages are acceptable where relevant.

#### 1.4 User Nav (Footer)
- Show **"Sign out"** only. Impersonation handling does **not** apply to the admin dashboard.

### 2. Operator App – Protected Layout

#### 2.1 Auth Gate – No Org
- A signed-in user who has **not joined any organization** must be redirected to a **"Pending invitations"** screen (not the dashboard).
- Check org membership via `organization.list()` or active org.
- If user has no orgs, redirect to `/invitations` or similar.

#### 2.2 Routing – Org Slug
- Group all org-scoped pages under a layout route using the **same pattern as** `_protected` (pathless layout that wraps its children).
- Use `_protected.$orgSlug` (or equivalent): a layout route whose path segment is the org slug, wrapping all org-scoped pages (dashboard, etc.).
- URLs: `/:orgSlug/dashboard`, `/:orgSlug/…` so org context is in the path.
- Validate that the user is a member of the org for that slug in the layout’s `beforeLoad`.

#### 2.3 Org Selection Page
- When URL `orgSlug` ≠ `session.activeOrganizationSlug`, redirect to `/organizations` (or equivalent).
- Page lists all user's organizations via `organization.list()`.
- User selects one → call `authClient.organization.setActive({ organizationId, organizationSlug })` → redirect to `/${organizationSlug}/dashboard`.
- No sidebar org switcher (selection is a full-page flow when mismatch occurs).

#### 2.4 App Shell
- Create an **operator-specific** app shell with base sidebar components.
- No TeamSwitcher in sidebar.

#### 2.5 Nav Links
- Minimal placeholder links only.

#### 2.6 User Nav (Footer)
- When `session.impersonatedBy` is set, render **"Stop impersonating"** and call `authClient.admin.stopImpersonating()`.
- Otherwise render **"Sign out"**.

### 3. Shared / Base Components

#### 3.1 Sidebar Base
- Keep `Sidebar`, `SidebarProvider`, `SidebarInset`, `SidebarTrigger`, `NavUser`, `NavMain`, etc. in `packages/ui`. They are shared.

#### 3.2 App Shells
- Each app gets its own app shell component that composes base sidebar parts with app-specific nav items and layout.
- `packages/ui/src/base/app-sidebar.tsx` is **reference only**; apps must NOT import it for their shell.

#### 3.3 NavUser Enhancement
- Extend or parameterize `NavUser` so it can show **"Sign out"** (admin and default) or **"Stop impersonating"** (operator only, when session is impersonated).
- Use `onSignOut` / `onStopImpersonating` callbacks, or `impersonated` boolean + handlers.
- The component must NOT import auth client directly; pass props or render props.

### 4. Session – Active Organization (Id + Slug)
- Use Better Auth `databaseHooks.session.create.before` to set both `activeOrganizationId` and `activeOrganizationSlug` when a session is created.
- The query `getInitialOrganization(userId)` is defined in the **db package** and returns `{ id, slug }` for the user's initial/default org (e.g. first org by membership).
- Use the **preloading** pattern from db-agent skills: Drizzle `.prepare()` for this hot query (see agent-stack `database/performance.md`).
- Add `activeOrganizationSlug` to session `additionalFields` if not already provided by the organization plugin.

### 5. Handoff Redirect
- Currently handoff goes to `/dashboard`.
- After org slug routing, handoff should go to `/:orgSlug/dashboard` where orgSlug is the user's active org (from `organization.list()[0]` or session after OTT verify).
- Resolve org slug from first org in `organization.list()` after OTT verify. If no org, redirect to `/invitations`.

### 6. Root Layout
- Root `__root.tsx` has a header + main.
- Sidebar app shell replaces the header for protected routes, or lives inside the root.
- Pattern: root renders Outlet; `_admin`/`_protected` layout wraps with SidebarProvider + sidebar + SidebarInset.

## Clarifications / Assumptions

- **Admin "role needs update" screen:** Static messaging. No self-service role upgrade.
- **Admin user nav:** Always "Sign out" only. No impersonation handling.
- **Operator invitations:** Better Auth has `organization.listUserInvitations()` for pending invitations. Use client-side API.
- **Session hooks:** `databaseHooks.session.create.before` calls `getInitialOrganization(session.userId)` from db package. Returns `{ id, slug }` or null. Set `activeOrganizationId` and `activeOrganizationSlug` on session.
- **Preloading:** Use Drizzle `.prepare()` for `getInitialOrganization` (db-agent performance pattern) — hot query on every session create.
- **Org protection:** Compare `params.orgSlug` with `session.activeOrganizationSlug`. Mismatch → redirect to `/organizations`. Org selection page → `setActive` → redirect to `/${slug}/dashboard`.
- **Handoff:** Redirect to `/:orgSlug/dashboard` after `organization.list()` yields user's first org slug. If no org, redirect to `/invitations`.
- **Impersonation:** Only operator app shows "Stop impersonating" when `session.impersonatedBy` is set (admin impersonating operator).

## Acceptance Criteria

- [ ] Non-admin signed-in user sees role block screen (admin app).
- [ ] Admin app has sidebar shell with nav links: Users, Customers, Contracts, Machines.
- [ ] Admin user nav shows "Sign out" only.
- [ ] Operator with no orgs is redirected to /invitations (pending invitations screen).
- [ ] Operator org-scoped routes use `_protected.$orgSlug` layout pattern; URLs like `/:orgSlug/dashboard`.
- [ ] When URL orgSlug ≠ session.activeOrganizationSlug, user is redirected to org selection page.
- [ ] Org selection page lists user's orgs; on select → setActive({ organizationId, organizationSlug }) → redirect to that org's dashboard.
- [ ] Session stores activeOrganizationId and activeOrganizationSlug (set via databaseHooks.session.create.before using getInitialOrganization from db package).
- [ ] getInitialOrganization query is in db package and uses prepared statement (preloading) pattern.
- [ ] Operator app has sidebar shell.
- [ ] Operator user nav shows "Stop impersonating" when impersonating, else "Sign out".
- [ ] Handoff redirects to `/:orgSlug/dashboard` after OTT verify.
- [ ] NavUser is parameterized (no direct auth client import).

## Open Questions

- None — all resolved per requirements.

## Out of Scope

- Self-service admin role upgrade.
- TeamSwitcher in sidebar (org selection is a full-page flow when URL/session mismatch).
- Custom tRPC for invitations (use Better Auth `organization.listUserInvitations()`).
