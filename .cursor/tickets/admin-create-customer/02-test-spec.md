# Test Specification: Admin Create Customer

## 1. Overview

This document defines the test cases for the admin create-customer feature — a two-step wizard that creates a user (step 1) and an organization for that user (step 2). The specification covers **18 test cases** across Unit (6) and Integration (12) layers. E2E tests are **out of scope** for this feature. Integration tests are the primary layer for API and auth boundaries. Unit tests for UI logic (UT-01–UT-04) use **React Testing Library** to test form validation behaviour. Every test case traces to an acceptance criterion in the requirements document.

---

## 2. Unit Test Cases

### Layer: UI Logic / Client-Side Validation (React Testing Library)

Unit tests UT-01–UT-04 are implemented with **React Testing Library** and **Vitest**. They render the create-customer form and assert that validation errors appear when required fields are empty or partially filled. Use `@testing-library/react`, `@testing-library/user-event`, and `screen`/`getByRole`/`getByLabelText` for interactions and assertions.

```
ID:          UT-01
Layer:       UI Logic
Traces to:   AC-6 (Missing required fields)
Description: Given the admin is on step 1 and submits the form with all required fields (email, password, name) empty,
             when client-side validation runs,
             then an error is shown indicating which fields are required (email, password, name) and the form is not cleared.
Type:        Unhappy path
Docstring:   Verifies client-side required-field validation for step 1 before any API call. Ensures the admin
             receives clear feedback about missing fields. Ticket: admin-create-customer, AC-6.
```

```
ID:          UT-02
Layer:       UI Logic
Traces to:   AC-6 (Missing required fields)
Description: Given the admin is on step 1 and submits with only email filled (password and name empty),
             when client-side validation runs,
             then an error is shown for the missing password and name fields.
Type:        Unhappy path
Docstring:   Verifies partial-validation case for step 1. Ticket: admin-create-customer, AC-6.
```

```
ID:          UT-03
Layer:       UI Logic
Traces to:   AC-6 (Missing required fields)
Description: Given the admin is on step 2 and submits the form with name and slug empty,
             when client-side validation runs,
             then an error is shown indicating which fields are required (name, slug).
Type:        Unhappy path
Docstring:   Verifies client-side required-field validation for step 2. Ticket: admin-create-customer, AC-6.
```

```
ID:          UT-04
Layer:       UI Logic
Traces to:   AC-6 (Missing required fields)
Description: Given the admin is on step 2 and submits with only name filled (slug empty),
             when client-side validation runs,
             then an error is shown for the missing slug field.
Type:        Unhappy path
Docstring:   Verifies partial-validation case for step 2. Ticket: admin-create-customer, AC-6.
```

### Layer: Data Model / Validation (if schema validation exists)

```
ID:          UT-05
Layer:       Data Model / Validation
Traces to:   AC-1 (Happy path — data shape)
Description: Given a valid user payload (email, password, name),
             when the payload is validated (if a schema exists),
             then it passes validation.
Type:        Happy path
Docstring:   Verifies valid user creation payload shape. Ticket: admin-create-customer, AC-1.
```

```
ID:          UT-06
Layer:       Data Model / Validation
Traces to:   AC-1 (Happy path — data shape)
Description: Given a valid organization payload (name, slug, userId) with optional logo and metadata,
             when the payload is validated (if a schema exists),
             then it passes validation.
Type:        Happy path
Docstring:   Verifies valid organization creation payload shape. Ticket: admin-create-customer, AC-1.
```

---

## 3. Integration Test Cases

### Layer: API + Auth — Create User (Step 1)

```
ID:          IT-01
Layer:       API + Auth
Traces to:   AC-1 (Happy path)
Description: Given an authenticated admin session, when they call the create-user API with valid email, password, and name,
             then a user is created in the database and the API returns the new user ID.
Type:        Happy path
Docstring:   Verifies the create-user API succeeds for an admin and persists to DB. Primary integration test for
             step 1. Ticket: admin-create-customer, AC-1.
```

```
ID:          IT-02
Layer:       API + Auth
Traces to:   AC-2 (Duplicate email)
Description: Given an authenticated admin session and an existing user with email "existing@example.com",
             when they call the create-user API with the same email,
             then the API returns an error (e.g. duplicate email) and no new user is created.
Type:        Unhappy path
Docstring:   Verifies duplicate email is rejected by the API. Required for step 1 error handling.
             Ticket: admin-create-customer, AC-2.
```

```
ID:          IT-03
Layer:       API + Auth
Traces to:   AC-2 (Duplicate email), AC-5 (API failure)
Description: Given an authenticated admin session, when they call the create-user API with missing required fields
             (e.g. empty email or password),
             then the API returns a validation error indicating which fields are required.
Type:        Unhappy path
Docstring:   Verifies API-level validation for required fields when client validation is bypassed.
             Ticket: admin-create-customer, AC-2, AC-5.
```

```
ID:          IT-04
Layer:       API + Auth
Traces to:   Auth boundary (admin required — per stack)
Description: Given an authenticated non-admin user (or no session), when they attempt to call the create-user API,
             then the request is rejected with 401 or 403.
Type:        Unhappy path
Docstring:   Verifies admin-only access to create-user. Auth is enforced at application layer.
             Ticket: admin-create-customer, auth boundary.
```

### Layer: API + Auth — Create Organization (Step 2)

```
ID:          IT-05
Layer:       API + Auth
Traces to:   AC-1 (Happy path)
Description: Given an authenticated admin session and an existing user ID, when they call the create-organization API
             with valid name, slug, and userId,
             then an organization is created, the user is linked as a member, and the API returns the new organization ID.
Type:        Happy path
Docstring:   Verifies the create-organization API succeeds and persists user-org link. Primary integration test for
             step 2. Ticket: admin-create-customer, AC-1.
```

```
ID:          IT-06
Layer:       API + Auth
Traces to:   AC-1 (Happy path)
Description: Given an authenticated admin session and an existing user ID, when they call the create-organization API
             with valid name, slug, userId, and optional logo and metadata,
             then the organization is created with all provided fields.
Type:        Happy path
Docstring:   Verifies optional fields (logo, metadata) are accepted and persisted. Ticket: admin-create-customer, AC-1.
```

```
ID:          IT-07
Layer:       API + Auth
Traces to:   AC-3 (Duplicate slug)
Description: Given an authenticated admin session and an existing organization with slug "existing-org",
             when they call the create-organization API with the same slug,
             then the API returns an error (e.g. duplicate slug) and no new organization is created.
Type:        Unhappy path
Docstring:   Verifies duplicate slug is rejected by the API. Required for step 2 error handling.
             Ticket: admin-create-customer, AC-3.
```

```
ID:          IT-08
Layer:       API + Auth
Traces to:   AC-3, AC-6 (Missing required fields)
Description: Given an authenticated admin session, when they call the create-organization API with missing required
             fields (e.g. empty name or slug),
             then the API returns a validation error indicating which fields are required.
Type:        Unhappy path
Docstring:   Verifies API-level validation for organization required fields. Ticket: admin-create-customer, AC-3, AC-6.
```

```
ID:          IT-09
Layer:       API + Auth
Traces to:   AC-4 (Step 2 fails after step 1)
Description: Given an authenticated admin session and an existing user (simulating step 1 success), when they call
             the create-organization API with an invalid userId (e.g. non-existent),
             then the API returns an error and no organization is created. The user still exists.
Type:        Unhappy path
Docstring:   Verifies step 2 can fail independently; user from step 1 is not rolled back. Ticket: admin-create-customer, AC-4.
```

```
ID:          IT-10
Layer:       API + Auth
Traces to:   Auth boundary (admin required)
Description: Given an authenticated non-admin user (or no session), when they attempt to call the create-organization API,
             then the request is rejected with 401 or 403.
Type:        Unhappy path
Docstring:   Verifies admin-only access to create-organization. Ticket: admin-create-customer, auth boundary.
```

### Layer: API + Auth — Full Flow (Step 1 → Step 2)

```
ID:          IT-11
Layer:       API + Auth
Traces to:   AC-1 (Happy path)
Description: Given an authenticated admin session, when they call create-user with valid data, then call create-organization
             with the returned userId and valid name/slug,
             then both user and organization exist, and the user is a member of the organization.
Type:        Happy path
Docstring:   Verifies the full two-step flow at the API layer — wiring between create-user and create-organization.
             Ticket: admin-create-customer, AC-1.
```

```
ID:          IT-12
Layer:       API + Auth
Traces to:   AC-4 (Step 2 retry after step 1)
Description: Given an authenticated admin session, a user created in step 1, and a failed first attempt at create-organization
             (e.g. duplicate slug), when they retry create-organization with a new valid slug and the same userId,
             then the organization is created and the user is linked as a member.
Type:        Happy path (retry)
Docstring:   Verifies step 2 retry works without redoing step 1. userId is preserved. Ticket: admin-create-customer, AC-4.
```

---

## 4. Coverage Map

| AC ID | Criterion (short label)                          | Test Cases                                      | Gap? |
| ----- | ------------------------------------------------ | ----------------------------------------------- | ---- |
| AC-1  | Happy path — both steps succeed, user+org exist  | IT-01, IT-05, IT-06, IT-11, UT-05, UT-06        | No   |
| AC-2  | Duplicate email → error, stay step 1, retry      | IT-02, IT-03                                    | No   |
| AC-3  | Duplicate slug → error, stay step 2, retry      | IT-07, IT-08                                    | No   |
| AC-4  | Step 2 fails after step 1 → retry step 2 only    | IT-09, IT-12                                    | No   |
| AC-5  | API failure → error shown, no blank screen       | IT-03                                           | No   |
| AC-6  | Missing required fields → validation error       | UT-01, UT-02, UT-03, UT-04, IT-03, IT-08        | No   |
| Auth  | Admin required for create-user/create-org        | IT-04, IT-10                                    | No   |

---

## 6. Explicitly Out of Scope

- **Admin authentication/authorization** — Enforced by admin route guard or procedure; not tested in this spec beyond noting admin-only API access.
- **Heavy validation** (email format, slug format, password strength) — Rely on API behaviour; no unit tests for format validation.
- **Welcome/invite email or password-reset flow** — No test cases for post-creation notifications.
- **Automatic rollback** if organization creation fails — Not required; IT-09 verifies partial success is acceptable.
- **Edit existing users or organizations** — Not in scope.
- **Audit logging** — Not in scope.
- **Back button** (step 2 → view step 1) — UI spec describes it; no explicit test; view-only back navigation could be added if product deems it critical.

---

## 7. Suggested Test File Layout

```
apps/admin-frontend/
  src/routes/_admin/
    create-customer.test.tsx          # UT-01, UT-02, UT-03, UT-04 (React Testing Library)
tests/                                (new — at repo root)
  customers/                          (new)
    create-user.test.ts               # IT-01, IT-02, IT-03, IT-04
    create-organization.test.ts       # IT-05–IT-10
    create-customer-flow.test.ts      # IT-11, IT-12
    validation.test.ts               # UT-05, UT-06 (if schema validation exists)
```

Note: The `tests/` directory does not yet exist. UT-01–UT-04 live alongside the wizard; integration tests at repo root.

---

## 8. Test Setup Notes & Prerequisites

### Current Status (project has no test infrastructure)

The project **does not yet have** Vitest, React Testing Library, PGlite, or Better Auth testUtils configured. T01 (or a prerequisite setup task) must establish:

| Prerequisite | Status | Purpose |
|--------------|--------|---------|
| **Vitest** | Not installed | Test runner for unit and integration tests |
| **@testing-library/react** | Not installed | UT-01–UT-04: render form, assert validation errors |
| **@testing-library/user-event** | Not installed | Simulate user interactions |
| **jsdom** or **happy-dom** | Not installed | DOM environment for RTL |
| **PGlite** | Not installed | In-memory Postgres for integration tests |
| **Better Auth testUtils** | Not in auth config | createUser, saveUser, getAuthHeaders for integration tests |
| **vitest.config.ts** | Does not exist | Configure test env, globals, path aliases |
| **tests/** directory | Does not exist | Location for integration tests |

### Admin Session for Integration Tests

- Use **Better Auth testUtils** (e.g. `createUser`, `saveUser`) with **PGlite** in-memory Postgres.
- Create an admin user: set `role: "admin"` when creating the user.
- Obtain auth headers via `getAuthHeaders` or equivalent to attach session cookies/tokens to requests.
- Pattern: `createUser → saveUser → getAuthHeaders → call route → assert → cleanup`.

### APIs Under Test

- **createUser**: `authClient.admin.createUser({ email, password, name, role: "user", data? })` — Better Auth admin plugin. In integration tests, call the HTTP endpoint or the underlying auth API that the client invokes.
- **createOrganization**: `auth.api.createOrganization({ body: { name, slug, logo?, metadata?, userId } })` — Better Auth organization plugin. May be invoked server-side or via a tRPC procedure; integration tests should hit the actual API boundary.

### Test Data

- Use unique emails and slugs per test (e.g. `test-${Date.now()}@example.com`) to avoid cross-test pollution.
- For duplicate-email/slug tests, pre-create a user or organization with the known identifier before the test runs.
