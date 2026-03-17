# UI/UX Specification: Admin Impersonation Handoff to Operator Dashboard

## 1. User Flow

### Happy Path

```
Admin is on user/operator list or detail view
    → Clicks "Open as user" / "View operator dashboard" for a target user
    → [Loading] Button shows spinner or "Opening...", disabled
    → New tab opens to operator.slushomat.com/auth/handoff?token=...
    → Admin tab: stopImpersonating() restores admin session
    → Operator tab: handoff page loads
    → Handoff page: calls oneTimeToken.verify({ token })
    → [Loading] "Signing in..." or spinner
    → Verify succeeds → session cookie set → redirect to /dashboard (operator)
    → Operator dashboard loads as impersonated user
```

### Error Flow (Admin Side)

```
Admin clicks "Open as user"
    → [Loading]
    → Impersonation or OTT generate fails (e.g. 403, network)
    → Inline error or toast: "Could not open operator dashboard. Please try again."
    → Admin session preserved, no new tab
    → Admin can retry
```

### Error Flow (Operator Handoff Page)

```
User lands on /auth/handoff?token=invalid-or-expired
    → [Loading] "Signing in..."
    → Verify fails (401, token consumed, expired)
    → Error state: "This link has expired or is invalid."
    → Link/button: "Go to sign in" → /sign-in
```

### Missing Token

```
User lands on /auth/handoff (no token)
    → Redirect to /sign-in or /dashboard
    → No error message; treat as invalid access
```

---

## 2. Component Mapping

### Admin Dashboard — Entry Points

| Element | Component | Notes |
|---------|-----------|-------|
| "Open as user" button | `Button` variant="ghost" or "outline" | Row action in user list, or on user detail page. Icon: external link or "user" icon. |
| Loading state | `Button` disabled + `Loader2` spinner or "Opening..." text | Replace icon/label during load. |
| Error display | Toast (`Sonner`) or inline `Alert` | Per project pattern; toast preferred for transient errors. |

**Placement**: Users page (`/users`) — a table lists all users. Each row has an "Open as user" button (or row actions dropdown with "Open as user"). No separate user detail page required for initial implementation.

### Operator App — Handoff Page

| Element | Component | Notes |
|---------|-----------|-------|
| Page container | Simple `div` or `Card` | Centered, minimal chrome. |
| Loading state | `Loader2` spinner + "Signing in..." text | Full-page or card. |
| Error state | `Alert` destructive + "Go to sign in" `Button` | When verify fails. |
| Route | `/auth/handoff` | Query param: `token`. |

---

## 3. State Definitions

### Admin "Open as user" Button States

| State | Trigger | User sees |
|-------|---------|-----------|
| **Idle** | Initial | Button enabled, "Open as user" or "View operator dashboard" |
| **Loading** | Click | Button disabled, spinner or "Opening..." |
| **Success** | New tab opened, stopImpersonating done | Button returns to idle (admin stays on page) |
| **Error** | Impersonation or OTT fails | Toast or inline error. Button re-enabled. |

### Operator Handoff Page States

| State | Trigger | User sees |
|-------|---------|-----------|
| **Loading** | Page load with token | "Signing in..." + spinner |
| **Redirecting** | Verify success | Brief loading, then redirect to /dashboard |
| **Error** | Verify fails (invalid, expired, used) | "This link has expired or is invalid." + "Go to sign in" button |
| **No token** | Page load without token | Redirect to /sign-in (or /dashboard) — no intermediate UI |

---

## 4. Error Handling Patterns

### Admin Side

- **Location**: Toast (preferred) or inline below button.
- **Content**: "Could not open operator dashboard. Please try again." — or use API error message if available.
- **Retry**: User clicks button again; no explicit "Retry" needed.

### Operator Handoff Page

- **Location**: Centered card or full-width message.
- **Content**: "This link has expired or is invalid."
- **Action**: "Go to sign in" — navigates to operator `/sign-in`.
- **Accessibility**: `role="alert"` on error message.

---

## 5. UX Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| New tab vs same tab | New tab | Admin stays in admin; operator dashboard in separate tab. |
| Handoff page URL | `/auth/handoff?token=...` | Clear, shareable (though one-time). Token in URL is required for cross-domain redirect. |
| Loading feedback | Button spinner + disabled | Prevents double-click; clear feedback. |
| Error on admin side | Toast | Transient; doesn't block workflow. |
| Error on handoff | Full message + CTA | User may have arrived via bookmark or stale link; need clear next step. |
| Operator redirect after verify | `/dashboard` | Primary landing after auth. |

---

## 6. Responsive

### Admin Button

- Fits in row actions (desktop) or overflow menu (mobile).
- No special responsive treatment beyond layout.

### Operator Handoff Page

- Centered card or message at all breakpoints.
- Minimal layout; loading and error states stack vertically.
- Target: mobile and desktop (operator dashboard may be used on tablet/mobile).

---

## 7. Accessibility

| Consideration | Implementation |
|---------------|----------------|
| Button label | "Open as user" or "View operator dashboard" — clear and descriptive. |
| Loading | `aria-busy="true"` on button during load. Disabled state. |
| Error | `role="alert"` on error message so screen readers announce it. |
| Handoff page | Semantic structure; loading and error states announced. |

---

## 8. Route & Entry

### Admin Dashboard

- **Entry**: "Open as user" button in the Users list table.
- **Route**: `/users` — Users page with table of all users; each row has an "Open as user" action.
- **Layout**: Uses `_admin` layout (auth guard applied).

### Operator App

- **Route**: `/auth/handoff`
- **Query**: `token` (required for verify)
- **Layout**: Likely outside protected layout — no session until verify succeeds. Redirect to `/dashboard` after success.

---

## 9. Open UX Questions

1. **Button label**: "Open as user", "View operator dashboard", or "Impersonate"? — Recommend: "Open as user" (clearer) or "View as operator".
2. **Operator handoff layout**: Use existing auth layout (e.g. sign-in page style) or minimal standalone? — Recommend: Match sign-in page style for consistency.
