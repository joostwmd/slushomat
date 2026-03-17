# UI/UX Specification: Admin Create Customer

## 1. User Flow

### Happy Path

```
Admin lands on Create Customer page
    → Sees Step 1 (Create User)
    → Fills: email, password, name
    → Clicks "Create user & continue"
    → [Loading] Button disabled, "Please wait..."
    → User created successfully → Step 2 (Create Organization) appears
    → Fills: name, slug, (optional) logo, (optional) metadata
    → Clicks "Create organization"
    → [Loading]
    → Success → Toast + success state shown
    → Admin can: "Go to dashboard" | "Create another customer"
```

### Back Navigation

- **Step 1 → Step 2**: One-way. No "back" from step 2 to step 1 in the wizard (user already exists; changing would require a separate edit flow).
- **Step 2**: Show a "Back" (ghost/secondary) button that returns to step 1 *view* only — for context/review. Step 2 form stays editable. Submitting step 2 does not re-submit step 1.
- **Alternative (simpler)**: No back button. Step 2 is the only editable step; step 1 data is displayed read-only (email, name) for confirmation.

**Decision**: Include a subtle "Back" to review step 1 (read-only). User cannot re-edit step 1 — only view. This avoids accidental re-submission and keeps the flow simple.

### Error States

| Scenario | Where | Behavior |
|----------|-------|----------|
| Step 1: Duplicate email | Step 1 | Inline error below form. Form stays filled. Admin corrects and retries. |
| Step 1: Missing fields | Step 1 | Inline validation (required). Show which fields are missing. |
| Step 1: API error / timeout | Step 1 | Inline error. "Retry" affordance (resubmit). |
| Step 2: Duplicate slug | Step 2 | Inline error below form. Form stays filled. Admin corrects and retries. |
| Step 2: Missing name/slug | Step 2 | Inline validation. Show which fields are missing. |
| Step 2: API error / timeout | Step 2 | Inline error. "Retry" affordance. userId preserved; no redo of step 1. |
| Step 2 fails after step 1 succeeded | Step 2 | Error displayed. User exists, org does not. Admin retries step 2 only. |

### Flow Diagram (Bullet Form)

```
[Entry] Create Customer page
   |
   v
[Step 1] Create User
   |-- Form: email, password, name
   |-- Submit → Loading
   |-- Success → Transition to Step 2
   |-- Error  → Inline error, stay on Step 1, retry
   |
   v
[Step 2] Create Organization
   |-- Form: name, slug, logo (optional), metadata (optional)
   |-- Display: "User: {email}" (read-only summary)
   |-- Back → View step 1 summary (read-only), return to step 2
   |-- Submit → Loading
   |-- Success → Success state
   |-- Error  → Inline error, stay on Step 2, retry
   |
   v
[Success] Confirmation
   |-- "Customer created: {user name} / {org name}"
   |-- Actions: "Go to dashboard" | "Create another customer"
```

---

## 2. Component Mapping

### Layout

| Element | Shadcn / Package | Notes |
|---------|------------------|-------|
| Page container | `div` + Tailwind | Same as dashboard: `container mx-auto max-w-3xl px-4 py-8` |
| Page title | `h1` | "Create customer" |
| Step indicator | Custom (no Shadcn Stepper) | Simple: "1. User" / "2. Organization" with visual state (completed, current) |

### Step 1 — Create User

| Element | Component | Notes |
|---------|-----------|-------|
| Form container | `Card` | CardHeader, CardContent, CardFooter |
| Card title | `CardTitle` | "Create user" |
| Card description | `CardDescription` | "Enter email, password, and name for the new user." |
| Email field | `Label` + `Input` | `type="email"`, `autoComplete="email"`, `required` |
| Password field | `Label` + `Input` | `type="password"`, `autoComplete="new-password"`, `required` |
| Name field | `Label` + `Input` | `type="text"`, `autoComplete="name"`, `required` |
| Submit button | `Button` | "Create user & continue" |
| Error message | `p` with `role="alert"` | `text-destructive`, above or below form (same pattern as auth-form) |

### Step 2 — Create Organization

| Element | Component | Notes |
|---------|-----------|-------|
| Form container | `Card` | Same structure |
| Card title | `CardTitle` | "Create organization" |
| Card description | `CardDescription` | "Set up the organization for this user." |
| User summary | `p` or `div` | Read-only: "User: {email} ({name})" — not a form field |
| Name field | `Label` + `Input` | Organization display name, `required` |
| Slug field | `Label` + `Input` | URL-safe identifier, `required` |
| Logo field | `Label` + `Input` | Optional, `type="url"` or `type="text"` |
| Metadata field | `Label` + `Input` or `Textarea` | Optional; early stage: simple text/textarea for JSON |
| Back button | `Button` variant="ghost" | "Back" — view step 1 summary |
| Submit button | `Button` | "Create organization" |
| Error message | `p` with `role="alert"` | Same pattern |

### Success State

| Element | Component | Notes |
|---------|-----------|-------|
| Success container | `Card` or `div` | Replace form with confirmation |
| Success message | `p` | "Customer created: {name} / {org name}" |
| Toast | `Sonner` | Optional duplicate: toast on success for persistence |
| Primary action | `Button` | "Go to dashboard" — navigates to `/dashboard` |
| Secondary action | `Button` variant="outline" | "Create another customer" — resets wizard to step 1 |

### Step Indicator (Simple)

```
[1. User ✓] ——— [2. Organization]
```

- Step 1 active: "1. User" emphasized, "2. Organization" muted
- Step 2 active: "1. User" with checkmark or muted, "2. Organization" emphasized
- Implement with `div` + conditional classes; no need for Stepper component at this stage

---

## 3. State Definitions

### Step 1 States

| State | Trigger | User sees |
|-------|---------|-----------|
| **Idle** | Initial load | Form with empty fields. Submit enabled. |
| **Loading** | Submit clicked | Button disabled, "Please wait...". Form fields disabled. No error shown. |
| **Success** | API returns success | Transition to step 2. Step indicator updates. |
| **Error** | API returns error | Inline error message (e.g. "Email already exists"). Form stays filled. Button re-enabled. |

### Step 2 States

| State | Trigger | User sees |
|-------|---------|-----------|
| **Idle** | After step 1 success | Form with empty org fields. User summary visible. Submit enabled. |
| **Loading** | Submit clicked | Button disabled, "Please wait...". Form fields disabled. |
| **Success** | API returns success | Success state: message + "Go to dashboard" / "Create another" |
| **Error** | API returns error | Inline error (e.g. "Slug already exists"). Form stays filled. userId preserved. Retry available. |

### Success State (Post-Wizard)

| State | Trigger | User sees |
|-------|---------|-----------|
| **Displayed** | Step 2 success | Confirmation card. Two buttons. Optional toast. |

### Back (View Step 1)

When user clicks "Back" from step 2:
- Show step 1 summary (read-only): email, name — no password
- "Return to organization" button to go back to step 2
- This is a temporary view, not a separate route

---

## 4. Error Handling Patterns

### Inline Validation

- **Required fields**: On submit, if empty: show inline message near field or in shared error block.
- **Format**: Single error block above submit button (like auth-form): "Email and password are required." or "Name and slug are required."
- **Field-level** (optional for early stage): Use `aria-invalid` on inputs when validation fails. Show error text below each invalid field if desired.

### API Error Display

- **Location**: Inline, inside Card, above the submit button (same pattern as auth-form).
- **Component**: `<p role="alert" className="text-destructive text-sm">...</p>`
- **Content**: Use API error message when available; otherwise generic: "Something went wrong. Please try again."
- **Persistence**: Error clears when user edits the form or resubmits (optional: clear on first edit).

### Retry

- No explicit "Retry" button; user corrects and clicks submit again.
- Form values preserved on error (controlled or defaultValues).

---

## 5. UX Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Optimistic updates | No | Creating user/org is a single source of truth; wait for API confirmation. |
| Wizard vs separate pages | Wizard | Requirements specify two-step on single screen. Keeps dependency explicit. |
| Back from step 2 to step 1 | View-only | User already exists. Back shows summary for context; no re-edit. |
| Success: redirect vs stay | Stay with actions | Show success state. "Go to dashboard" or "Create another" — user chooses. |
| Toast on success | Optional | Card confirmation is primary. Toast can reinforce; not required. |
| Step 1 data in step 2 | Read-only summary | Display email/name so admin confirms. No form fields. |
| Metadata field | Simple textarea | Early stage; JSON as raw text. Can validate later. |

---

## 6. Responsive

### Target Context

- **Primary**: Laptop and tablet (operations dashboard).
- **Secondary**: Smaller screens — ensure usability but not primary focus.

### Behavior

| Breakpoint | Layout |
|------------|--------|
| Desktop / Laptop | Single column form. Card max-width inherited from container (`max-w-3xl`). Step indicator horizontal. |
| Tablet | Same layout. Form remains full-width within container. No layout change. |
| Mobile (if used) | Same. Consider: stack step indicator vertically if needed; ensure buttons full-width on very small screens. |

### Notes

- No separate mobile layout (e.g. Sheet vs Dialog) — this is an admin tool.
- Form fields stack vertically at all sizes.
- Buttons: primary full-width within card (consistent with auth-form).

---

## 7. Accessibility

| Consideration | Implementation |
|---------------|----------------|
| Form labels | Every input has associated `Label` with `htmlFor` / `id`. |
| Error announcements | Error message has `role="alert"` so screen readers announce it. |
| Focus | On step transition, focus first field of step 2. On success, focus primary action. |
| aria-busy | Form has `aria-busy={loading}` during submit. |
| aria-invalid | Inputs get `aria-invalid` when validation or API error indicates invalid value. |
| Button states | Disabled + "Please wait..." during loading. |
| Step indicator | Use `aria-current="step"` on active step if using a list; or semantic headings. |

---

## 8. Empty States & Confirmations

### No Empty State

- Wizard always shows a form (step 1 or step 2). No "no customers" list on this page.

### Success Confirmation

- **Message**: "Customer created: {user name} / {org name}"
- **Actions**:
  1. "Go to dashboard" — `navigate('/dashboard')`
  2. "Create another customer" — reset wizard to step 1 (clear form, step = 1)
- **No redirect on success** — user stays until they choose an action.

---

## 9. Open UX Questions

1. **Create another**: Should "Create another customer" clear only the org form and keep the user, or reset everything? **Recommendation**: Full reset (step 1) — cleaner. User can re-enter if creating a similar customer.
2. **Logo field**: URL input vs file upload? **Requirements**: Logo as "URL or reference" — use `Input type="url"` or `type="text"` for early stage.
3. **Metadata**: Freeform textarea vs structured fields? **Recommendation**: Single textarea for JSON; validate/catch parse errors on submit if needed.
4. **Navigation away mid-flow**: No "unsaved changes" warning. Admin can leave; user created in step 1 persists. Acceptable per requirements.

---

## 10. Route & Entry

- **Route**: `/create-customer` or `/customers/new` (product decision).
- **Entry**: Link from admin dashboard — e.g. "Create customer" button or nav item.
- **Layout**: Uses `_admin` layout (auth guard already applied).
