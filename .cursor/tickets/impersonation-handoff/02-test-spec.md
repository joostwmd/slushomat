# Test Specification: Admin Impersonation Handoff to Operator Dashboard

## 1. Overview

This document defines the test cases for the admin impersonation handoff feature — allowing an admin to open the operator dashboard as an impersonated user via Better Auth's one-time token plugin. The specification covers **Unit (4)**, **Integration (6)**, and **E2E (2)** layers. Every test case traces to an acceptance criterion in the requirements document.

---

## 2. Unit Test Cases

### Layer: UI Logic — Admin "Open as user" Button (React Testing Library)

```
ID:          UT-01
Layer:       UI Logic (Admin)
Traces to:   AC-1 (Happy path — flow completes), AC-3 (Error handling)
Description: Given the admin is on the user detail page and the "Open as user" button is visible,
             when they click the button,
             then the button enters loading state (disabled, spinner or "Opening...") before the new tab opens.
Type:        Happy path
Docstring:   Verifies loading state during impersonation + OTT flow. Ticket: impersonation-handoff, AC-1.
```

```
ID:          UT-02
Layer:       UI Logic (Admin)
Traces to:   AC-3 (Error handling)
Description: Given the admin clicks "Open as user" and the impersonation API fails (mocked),
             when the error is returned,
             then an error message is displayed (toast or inline) and the button returns to enabled state.
Type:        Unhappy path
Docstring:   Verifies error state when impersonation fails. Ticket: impersonation-handoff, AC-3.
```

```
ID:          UT-03
Layer:       UI Logic (Operator Handoff)
Traces to:   AC-4 (Handoff page error)
Description: Given the operator handoff page loads with an invalid or missing token,
             when the verify fails or no token is present,
             then the error state is shown ("This link has expired or is invalid") or redirect occurs.
Type:        Unhappy path
Docstring:   Verifies handoff page error handling. Ticket: impersonation-handoff, AC-4.
```

```
ID:          UT-04
Layer:       UI Logic (Operator Handoff)
Traces to:   AC-1 (Happy path)
Description: Given the operator handoff page loads with a valid token (mocked verify success),
             when verify completes,
             then the user is redirected to /dashboard.
Type:        Happy path
Docstring:   Verifies successful handoff redirect. Ticket: impersonation-handoff, AC-1.
```

---

## 3. Integration Test Cases

### Layer: Auth + Better Auth APIs

```
ID:          IT-01
Layer:       API + Auth
Traces to:   AC-1 (Happy path), AC-2 (Impersonation session)
Description: Given an authenticated admin session and a target user ID, when the admin calls impersonateUser
             then impersonateUser, oneTimeToken.generate, and stopImpersonating in sequence,
             then an impersonation session is created (with impersonatedBy), an OTT is generated, and the admin
             session is restored.
Type:        Happy path
Docstring:   Verifies the full admin-side flow at the API layer. Ticket: impersonation-handoff, AC-1, AC-2.
```

```
ID:          IT-02
Layer:       API + Auth
Traces to:   AC-5 (Security — admin only)
Description: Given an authenticated non-admin user (role !== "admin"), when they attempt to call
             impersonateUser with a target userId,
             then the request is rejected with 403.
Type:        Unhappy path
Docstring:   Verifies admin-only access to impersonation. Ticket: impersonation-handoff, AC-5.
```

```
ID:          IT-03
Layer:       API + Auth
Traces to:   AC-5 (Security)
Description: Given no session (unauthenticated), when impersonateUser is called,
             then the request is rejected with 401.
Type:        Unhappy path
Docstring:   Verifies authentication required. Ticket: impersonation-handoff, AC-5.
```

```
ID:          IT-04
Layer:       API + Auth
Traces to:   AC-4 (Handoff error)
Description: Given a valid one-time token, when oneTimeToken.verify is called,
             then the token is consumed, the session is returned, and a second call with the same token fails.
Type:        Happy path (one-time use)
Docstring:   Verifies OTT is single-use. Ticket: impersonation-handoff, AC-4.
```

```
ID:          IT-05
Layer:       API + Auth
Traces to:   AC-4 (Handoff error)
Description: Given an expired or invalid one-time token, when oneTimeToken.verify is called,
             then the request fails with an appropriate error (401 or similar).
Type:        Unhappy path
Docstring:   Verifies expired/invalid token handling. Ticket: impersonation-handoff, AC-4.
```

```
ID:          IT-06
Layer:       API + Auth
Traces to:   AC-2 (Audit)
Description: Given an impersonation session is created, when the session is queried from the database,
             then impersonatedBy equals the admin's user ID.
Type:        Happy path
Docstring:   Verifies audit trail in session. Ticket: impersonation-handoff, AC-2.
```

---

## 4. E2E Test Cases (Playwright)

```
ID:          E2E-01
Layer:       E2E
Traces to:   AC-1 (Happy path)
Description: Given an admin is signed in and viewing a user, when they click "Open as user",
             then a new tab opens, the operator dashboard loads in that tab as the impersonated user,
             and the admin tab still shows the admin dashboard.
Type:        Happy path
Docstring:   Full flow from admin click to operator dashboard. Ticket: impersonation-handoff, AC-1.
```

```
ID:          E2E-02
Layer:       E2E
Traces to:   AC-4 (Handoff error)
Description: Given a user navigates directly to /auth/handoff?token=invalid-token,
             when the page loads,
             then an error message is shown and a "Go to sign in" link is present.
Type:        Unhappy path
Docstring:   Verifies handoff page error state in real browser. Ticket: impersonation-handoff, AC-4.
```

---

## 5. Coverage Map

| AC ID | Criterion (short label)                    | Test Cases                              | Gap? |
| ----- | ----------------------------------------- | --------------------------------------- | ---- |
| AC-1  | Happy path — new tab, operator as user     | UT-01, UT-04, IT-01, E2E-01             | No   |
| AC-2  | Impersonation session has impersonatedBy   | IT-01, IT-06                            | No   |
| AC-3  | Error on admin side — message, no tab      | UT-02                                   | No   |
| AC-4  | Handoff page error for bad/expired token   | UT-03, IT-04, IT-05, E2E-02             | No   |
| AC-5  | Non-admin cannot impersonate               | IT-02, IT-03                            | No   |

---

## 6. Explicitly Out of Scope

- Server-side Redis handoff flow (alternative approach).
- Impersonating admin users (`impersonate-admins` permission).
- Audit log UI for impersonation events.
- Operator dashboard functionality beyond handoff (operator app tests are out of scope except handoff page).

---

## 7. Suggested Test File Layout

```
apps/admin-frontend/
  src/routes/_admin/
    users/
      [userId].test.tsx                    # UT-01, UT-02 (if button on user detail)
    components/
      open-as-user-button.test.tsx         # UT-01, UT-02 (if extracted component)

apps/operator-frontend/
  src/routes/
    auth/
      handoff.test.tsx                     # UT-03, UT-04

tests/                                      (at repo root)
  impersonation-handoff/
    impersonate-flow.test.ts               # IT-01, IT-02, IT-03, IT-06
    one-time-token.test.ts                 # IT-04, IT-05

e2e/                                        (Playwright, if present)
  impersonation-handoff.spec.ts             # E2E-01, E2E-02
```

---

## 8. Test Setup Notes & Prerequisites

### Better Auth + OTT Plugin

- Add `oneTimeToken()` to auth server plugins.
- Add `oneTimeTokenClient()` to auth client (admin and operator both need it for their respective flows).
- Operator frontend needs `authClient` with `oneTimeTokenClient()` for the handoff page.

### Admin Session for Integration Tests

- Use Better Auth testUtils (e.g. `createUser`, `saveUser`) with `role: "admin"`.
- Obtain auth headers for API requests.
- Create a target user (non-admin) to impersonate.

### OTT Verify in Operator Context

- Integration tests for verify can call `auth.api.verifyOneTimeToken` server-side, or hit the HTTP endpoint with a token generated in a prior step.
- Ensure token is generated in the same test run (OTT expires in ~3 min by default).

### E2E Considerations

- Admin and operator may run on different ports in dev (e.g. admin: 5173, operator: 5174). Configure `VITE_OPERATOR_URL` or equivalent for the redirect target.
- New tab handling: Playwright must switch to the new page/tab after `window.open` to assert operator dashboard content.
