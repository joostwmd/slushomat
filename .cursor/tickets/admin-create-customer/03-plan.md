# Execution Plan: Admin Create Customer

## 1. Thinking

### Layer Breakdown

The requirements touch three layers:

1. **Database** — No custom DB logic. Better Auth's `auth.api.createOrganization` supports `userId` in the body — it creates an org for that user who becomes the admin. Uses existing schema.

2. **API** — createUser is handled by the Better Auth admin plugin via `authClient.admin.createUser` (client-side HTTP to `/api/auth/*`). No tRPC procedure needed. createOrganization requires a server-side bridge because `auth.api.createOrganization` needs session cookies (`headers`) — the client cannot pass these. The api-agent creates a thin `admin.createOrganization` tRPC procedure that forwards to `auth.api.createOrganization({ body: { name, slug, logo?, metadata?, userId, keepCurrentActiveOrganization: false }, headers })` with the incoming request headers. Admin session is enforced by adminProcedure.

3. **Auth** — Admin and organization plugins are already configured. Admin createUser works out of the box. No auth-agent task. Admin authorization is enforced by `adminProcedure` and the `_admin` route guard.

4. **Frontend** — Two-step wizard (step 1: user, step 2: organization) on a single page. Uses authClient.admin.createUser for step 1 and trpc.admin.createOrganization for step 2.

5. **Tests** — test-writer-agent (unit + integration) run first per TDD. Unit tests UT-01–UT-04 use **React Testing Library** for form validation. E2E tests are out of scope. No db-agent or storage-agent work — existing schema is sufficient. Project has no test infrastructure yet; T01 includes prerequisite setup (Vitest, RTL, PGlite, Better Auth testUtils).

### Dependency Decisions

- **T03 (api-agent) → T04 (frontend-agent)**: The frontend calls `trpc.admin.createOrganization.mutate()`. The procedure must exist.
- **T01, T02 (test agents)**: No dependencies. Tests are written against the specified API contract (Better Auth endpoints, tRPC procedure) and will fail (red) until implementation.
- **T04 (frontend)** depends on T03 (api).

### Ambiguities Resolved

- **createOrganization for userId**: Better Auth's `auth.api.createOrganization` accepts `userId` in the body — it creates the org for that user who becomes the admin. No custom DB logic. A thin tRPC procedure forwards the request to `auth.api.createOrganization` with the incoming request headers (session cookies).
- **createUser API surface**: Client calls `authClient.admin.createUser` directly. Integration tests hit the Better Auth HTTP route. No tRPC bridge.
- **Route path**: Use `/create-customer` under `_admin` layout (product can change later).
- **Tests directory**: Test spec suggests `tests/customers/` and `tests/e2e/` or `e2e/`. The project has no `tests/` dir yet. test-writer-agent creates `tests/customers/`; e2e-test-writer-agent creates `tests/e2e/` or `e2e/` per project conventions.

---

## 2. Execution Order Table

| Step | Task ID | Agent | Depends On | Parallel With |
|------|---------|-------|------------|---------------|
| 1 | T01 | test-writer-agent | — | — |
| 2 | T02 | api-agent | — | — |
| 3 | T03 | frontend-agent | T02 | — |
| 4 | T04 | mutation-tester-agent | T01–T03 | — |
| 5 | T05 | reviewer-agent | T04 | — |

**Note:** E2E tests are out of scope for this feature. No e2e-test-writer-agent task.

---

## 3. Per-Task Definitions

### T01 — Unit + Integration Tests

```
Task ID: T01
Agent: test-writer-agent
Layer: Tests
Description: Set up test infrastructure (Vitest, React Testing Library, PGlite, Better Auth testUtils) if not present.
             Then write unit tests (UT-01–UT-06) and integration tests (IT-01–IT-12) per 02-test-spec.md.
Artifact: vitest.config, tests/customers/*.test.ts, apps/admin-frontend/.../create-customer.test.tsx
Skills needed: skills/testing/_index.md, trpc.md, db-infra.md, db-queries.md
Commit message: test(customers): add unit and integration tests for admin create customer
Depends on: —
Risk: low
```

**Prerequisites (project has none):** Vitest, @testing-library/react, @testing-library/user-event, jsdom/happy-dom, PGlite, Better Auth testUtils plugin. See 02-test-spec.md §8.

**Test coverage:**
- UT-01–UT-04: Client-side validation via **React Testing Library** (render form, submit, assert errors)
- UT-05, UT-06: Payload validation (user, organization) if schema exists
- IT-01, IT-02, IT-03, IT-04: createUser API (Better Auth admin plugin HTTP endpoint)
- IT-05, IT-06, IT-07, IT-08, IT-09, IT-10: createOrganization API (tRPC procedure)
- IT-11, IT-12: Full flow (createUser → createOrganization, retry step 2)

**Acceptance criteria:** AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, Auth boundary

---

### T02 — admin.createOrganization tRPC Procedure

```
Task ID: T02
Agent: api-agent
Layer: API / Backend
Description: Add admin.createOrganization mutation to adminRouter. Input: { name, slug, logo?, metadata?, userId }.
             Uses adminProcedure. Validates required fields. Forwards to auth.api.createOrganization with incoming
             request headers (session cookies). Pass body: { name, slug, logo?, metadata?, userId, keepCurrentActiveOrganization: false }.
             Map Better Auth errors (e.g. duplicate slug) to TRPCError for consistent client handling.
Artifact: apps/server/src/trpc/routers/admin.ts
Skills needed: skills/api/trpc-routers.md, trpc-errors.md
Commit message: feat(api): add admin.createOrganization procedure (forwards to Better Auth)
Depends on: —
Risk: low
```

**Note:** createUser is not a tRPC procedure. Frontend uses authClient.admin.createUser (Better Auth HTTP). No custom DB logic — Better Auth handles org + member creation via `userId` in body.

**Enables:** IT-05–IT-12

---

### T03 — Create Customer Wizard UI

```
Task ID: T03
Agent: frontend-agent
Layer: UI / Frontend
Description: Build two-step create-customer wizard per 01-ui-spec.md. Step 1: email, password, name → authClient.admin.createUser.
             Step 2: name, slug, logo?, metadata? → trpc.admin.createOrganization.mutate(). User summary (read-only).
             Success state with "Go to dashboard" and "Create another customer". Route: /create-customer under _admin.
             Add entry link from admin dashboard.
Artifact: apps/admin-frontend/src/routes/_admin/create-customer.tsx, components if needed
Skills needed: skills/frontend/shadcn.md, skills/frontend/design/harden.md (error handling)
Commit message: feat(admin): add create customer wizard
Depends on: T02
Risk: low
```

---

### T04 — Mutation Testing

```
Task ID: T04
Agent: mutation-tester-agent
Layer: Tests
Description: Run Stryker mutation testing. Analyze survivors from create-user, create-organization, and wizard flows.
             Iterate to kill surviving mutants.
Artifact: Mutation report, survivor fixes
Commit message: test(mutation): run mutation testing for admin create customer
Depends on: T01, T02, T03
Risk: low
```

---

### T05 — Final Review

```
Task ID: T05
Agent: reviewer-agent
Layer: Review
Description: Final review of all artifacts. Verify acceptance criteria. Output review to .cursor/review-append.txt.
Artifact: Review appended to plan
Commit message: chore: reviewer report for admin create customer
Depends on: T04
Risk: none
```

---

## 4. Parallel Groups

- **T01** (test-writer-agent) runs first. Includes test infrastructure setup (Vitest, RTL, PGlite, Better Auth testUtils) if not present.
- **T02** (api-agent) starts after tests are written (TDD). T02 has no dependencies.
- **T03** waits for T02. **T04** and **T05** run sequentially at the end.

---

## 5. Out of Scope

- **E2E tests** — Not required for this feature.
- Admin authentication/authorization (enforced by admin procedure and route guard; already in place).
- Heavy validation (email format, slug format, password strength) — rely on API behavior.
- Welcome/invite email or password-reset for the new user.
- Automatic rollback if organization creation fails after user creation.
- Edit existing users or organizations in the same screen.
- Audit logging of create actions.
- Back button (step 2 → view step 1) — UI spec describes it; no explicit test; frontend-agent may add if time allows.

---

## 6. Invisible Knowledge

### System Rationale

- **Why use auth.api.createOrganization?** Better Auth's `auth.api.createOrganization` accepts `userId` in the body — it creates the org for that user who becomes the admin. No custom DB logic needed.
- **Why a tRPC procedure for createOrganization?** The Better Auth server API requires session cookies (`headers`). The client cannot pass these directly. A thin tRPC procedure forwards the incoming request headers to `auth.api.createOrganization`.
- **Why no tRPC for createUser?** The Better Auth admin plugin exposes createUser via HTTP. The client calls authClient.admin.createUser. Adding a tRPC wrapper would duplicate the auth boundary without benefit.
- **Why tests before implementation?** TDD ordering ensures tests define the contract first. Integration tests hit the real API boundary (Better Auth HTTP, tRPC).

### Invariants

- Admin session is required for both createUser (admin plugin) and createOrganization (adminProcedure).
- Step 1 must complete before step 2 (userId is required).
- User and organization creation are separate; no automatic rollback on step 2 failure.
- The user passed as `userId` becomes the org admin (Better Auth default for createOrganization with userId).

### Accepted Trade-offs

- Duplicate slug/email pre-checks are omitted; rely on API errors for early-stage simplicity.
- Metadata is stored as text/JSON; no structured validation.
- No "unsaved changes" warning when navigating away mid-flow.

### Rejected Alternatives

- Custom db-agent service (createOrganizationWithMember): Better Auth already supports `userId` in createOrganization. Unnecessary duplication.
- Single tRPC procedure for both steps: Keeps steps explicit and allows retry of step 2 without redoing step 1.
- Separate pages instead of wizard: Requirements specify a two-step wizard on a single screen.
