# Test Specification: Protected Layout Improvements

## 1. Overview

This document defines the test cases for the protected layout improvements feature — auth gates, sidebar app shells, org-aware routing (operator), and context-dependent user nav. The specification covers unit, integration, and E2E tests. Tests focus on layout rendering, auth boundary behaviour, and navigation flows.

---

## 2. Unit Test Cases

### Layer: NavUser Component (packages/ui)

```
ID:          UT-01
Layer:       UI Component
Traces to:   NavUser enhancement (AC: context-dependent Sign out / Stop impersonating)
Description: Given NavUser is rendered with impersonated=false and onSignOut/onStopImpersonating callbacks,
             when the user opens the dropdown,
             then "Sign out" is visible and "Stop impersonating" is not visible.
Type:        Happy path
Docstring:   Verifies NavUser shows Sign out when not impersonating. Ticket: protected-layout-improvements.
```

```
ID:          UT-02
Layer:       UI Component
Traces to:   NavUser enhancement (AC: context-dependent Sign out / Stop impersonating)
Description: Given NavUser is rendered with impersonated=true and onSignOut/onStopImpersonating callbacks,
             when the user opens the dropdown,
             then "Stop impersonating" is visible and "Sign out" is not visible (or secondary).
Type:        Happy path
Docstring:   Verifies NavUser shows Stop impersonating when impersonated. Ticket: protected-layout-improvements.
```

```
ID:          UT-03
Layer:       UI Component
Traces to:   NavUser enhancement (no auth client import)
Description: Given NavUser receives onSignOut callback, when the user clicks "Sign out",
             then onSignOut is invoked (mock assertion).
Type:        Happy path
Docstring:   Verifies NavUser invokes callback; component does not call auth client directly. Ticket: protected-layout-improvements.
```

```
ID:          UT-04
Layer:       UI Component
Traces to:   NavUser enhancement
Description: Given NavUser receives onStopImpersonating callback and impersonated=true, when the user clicks "Stop impersonating",
             then onStopImpersonating is invoked (mock assertion).
Type:        Happy path
Docstring:   Verifies NavUser invokes stop-impersonating callback. Ticket: protected-layout-improvements.
```

---

## 3. Integration Test Cases

### Layer: Admin Auth Gate

```
ID:          IT-01
Layer:       Auth / Route Guard
Traces to:   Admin auth gate (non-admin sees role block screen)
Description: Given a signed-in user with role !== "admin", when they navigate to /dashboard (admin),
             then they see the "role needs update" screen and are NOT redirected to sign-in.
Type:        Unhappy path
Docstring:   Verifies non-admin signed-in user sees block screen. Ticket: protected-layout-improvements.
```

```
ID:          IT-02
Layer:       Auth / Route Guard
Traces to:   Admin auth gate (admin has access)
Description: Given a signed-in user with role === "admin", when they navigate to /dashboard (admin),
             then they see the dashboard with sidebar.
Type:        Happy path
Docstring:   Verifies admin access. Ticket: protected-layout-improvements.
```

### Layer: Operator Auth Gate & Org

```
ID:          IT-03
Layer:       Auth / Route Guard
Traces to:   Operator auth gate (no org → invitations)
Description: Given a signed-in user with no organization membership (organization.list() returns empty),
             when they navigate to /dashboard or any org-scoped route,
             then they are redirected to /invitations.
Type:        Unhappy path
Docstring:   Verifies user without org is redirected to invitations. Ticket: protected-layout-improvements.
```

```
ID:          IT-04
Layer:       Auth / Route Guard
Traces to:   Operator org slug validation
Description: Given a signed-in user who is a member of org with slug "acme", when they navigate to /acme/dashboard,
             then they see the dashboard. When they navigate to /other-org/dashboard (org they are not a member of),
             then they are redirected or see an error.
Type:        Happy path + Unhappy path
Docstring:   Verifies org membership validation for dynamic route. Ticket: protected-layout-improvements.
```

---

## 4. E2E Test Cases

### Layer: Layout & Navigation

```
ID:          E2E-01
Layer:       E2E
Traces to:   Admin app shell, nav links
Description: Given an admin is signed in, when they load the admin app,
             then they see the sidebar with links for Users, Customers, Contracts, Machines.
Type:        Happy path
Docstring:   Verifies admin sidebar nav. Ticket: protected-layout-improvements.
```

```
ID:          E2E-02
Layer:       E2E
Traces to:   Operator app shell
Description: Given an operator is signed in with org membership, when they load the operator app at /:orgSlug/dashboard,
             then they see the sidebar with minimal nav links.
Type:        Happy path
Docstring:   Verifies operator sidebar. Ticket: protected-layout-improvements.
```

```
ID:          E2E-03
Layer:       E2E
Traces to:   Handoff redirect
Description: Given an admin impersonates a user and opens handoff link, when the OTT is verified,
             then the operator tab navigates to /:orgSlug/dashboard where orgSlug is the user's org.
Type:        Happy path
Docstring:   Verifies handoff redirects to org-scoped dashboard. Ticket: protected-layout-improvements.
```

---

## 5. Test Coverage Map

| Requirement                       | UT  | IT  | E2E |
|-----------------------------------|-----|-----|-----|
| Admin auth gate (role block)      | —   | IT-01 | —   |
| Admin access                      | —   | IT-02 | —   |
| Operator no-org → invitations     | —   | IT-03 | —   |
| Operator org slug validation      | —   | IT-04 | —   |
| NavUser enhancement               | UT-01–UT-04 | — | —   |
| Admin sidebar + nav               | —   | —   | E2E-01 |
| Operator sidebar                  | —   | —   | E2E-02 |
| Handoff redirect                  | —   | —   | E2E-03 |

---

## 6. Prerequisites (if test infra missing)

- Vitest, @testing-library/react, @testing-library/user-event
- Playwright (or equivalent) for E2E
- Mock auth client / session for unit/integration tests
