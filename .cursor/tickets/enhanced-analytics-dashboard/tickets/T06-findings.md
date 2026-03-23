# T06 — Review findings (Enhanced Analytics Dashboard)

**Date:** 2026-03-23  
**Scope:** Code review of `operator.analytics.*`, `admin.analytics.*`, `build-org-dashboard` / `build-platform-dashboard`, MV migration, and operator/admin analytics UI + `@slushomat/ui` composites.  
**Tests:** Per plan, automated tests waived — findings are static analysis + manual checklist.  
**T05:** Deferred (Supabase Edge Function later) — called out under ops/performance.

---

## Executive summary

| Area        | Verdict |
|------------|---------|
| **Security (core)** | **Pass** for typical operator users and admin-scoped pages, with **one clarification** on admin users calling **operator** tRPC. |
| **Performance**   | **Pass (code-level)** — MV + indexes present; **manual `EXPLAIN` still recommended** on staging/prod-sized data. |
| **UX vs 01-ui-spec** | **Pass** on chart-above-table, tooltips, no chart→table filtering, admin platform-only on `/dashboard`. **Gaps:** operator machine analytics live on a **sub-route**; time control uses **native date input** vs Calendar popover in spec. |
| **A11y (strict spec)** | **Partial** — Recharts/shadcn setup is reasonable; spec items (SR tables, live regions, arrow-key chart nav) are **not** fully implemented. |

No **P0** blockers identified for an internal/staged release if admin bypass and MV refresh cadence are accepted risks.

---

## Security

### SEC-001 — Operator org / machine isolation

| Check | Result |
|-------|--------|
| `operator.analytics.orgDashboard` resolves `orgSlug` → `organizationId`, then `assertUserMemberOfOrg` | ✅ `operator-analytics.ts` |
| `operator.analytics.machineDashboard` same + `buildOrgDashboard` → `assertMachineBelongsToOrg` when `machineId` set | ✅ `build-org-dashboard.ts` |
| Machine-scoped analytics rejects `businessEntityId` | ✅ `BAD_REQUEST` if `machineScope && businessEntityId` |

**Finding S-1 (P2 — clarify intent)**  
`operatorProcedure` **skips membership** when `session.user.role === "admin"` (`procedures.ts`). Any user with admin role can call **`operator.*`** (including `operator.analytics.*`) with **any** `orgSlug` and receive that org’s analytics without being a member.

- If **only operators** use the operator app: low practical risk.  
- If **admins** can obtain session tokens and hit the operator API: this is **cross-customer read** via operator routes (admin routes already allow cross-org by design).

**Recommendation:** Document as intentional “platform admin superuser on operator API”, **or** require membership even for admins on `operator.analytics.*` / all `operator.*`.

### SEC-002 — Admin access scope

| Check | Result |
|-------|--------|
| `admin.analytics.*` behind `adminProcedure` (role `admin`) | ✅ |
| `platformDashboard` — no `organizationId`; aggregates platform-wide | ✅ |
| Customer org charts use `organizationId` from route (`$customerId`) | ✅ |
| No platform charts embedded on customer/machine admin pages (spot-check) | ✅ `dashboard.tsx` only uses `AdminPlatformAnalyticsDashboard` |

**Note:** Admins can open any `$customerId` URL — expected for admin tooling; not a leakage bug.

### SEC-003 — Revenue / contract correctness

| Check | Result |
|-------|--------|
| MV definition joins contract version effective/ended window per purchase | ✅ `0000_analytics_purchase_daily_summary.sql` LATERAL on `operator_contract_version` |
| App-side analytics uses shared Drizzle helpers (`contractRevenueShareBasisPointsAtPurchase`, etc.) | ✅ `build-org-dashboard.ts` imports |

**Finding S-2 (P3)**  
Confirm **integer division / floor** policy for platform share matches `00-requirements.md` everywhere (MV SQL uses `(amount * basis_points) / 10000`; app should match).

---

## Performance

| Check | Result |
|-------|--------|
| MV unique index for `REFRESH CONCURRENTLY` | ✅ `analytics_purchase_daily_summary_uidx` on `(bucket_date, organization_id, machine_id)` |
| Supporting indexes | ✅ `org_bucket`, `machine_bucket` |
| Hybrid path: closed days from MV, “today” from live `purchase` | ✅ `build-org-dashboard.ts` (`canUseMvSlice`, `todayInRange`) |
| Degraded fallback on MV failure | ✅ try/catch → live query + `meta.degraded` |

**Finding P-1 (P2 — manual)**  
Run **`EXPLAIN (ANALYZE, BUFFERS)`** on staging for:

1. MV slice read for a wide org date range.  
2. Live “today” leg with org + optional `machineId`.  
3. `buildPlatformDashboard` hot queries (top orgs, totals).

Compare to **2s / 5s** budgets in `00-requirements.md` if still listed.

**Finding P-2 (P3)**  
Filters that include **`businessEntityId`** force **live** paths and **disable** MV slice (`canUseMvSlice` requires `!businessEntityId`). Expected; may be slower on large orgs — acceptable v1.

**Finding P-3 (ops)**  
**T05 deferred** — without scheduled refresh, historical MV data can be **stale**; product behavior is “correct but old” until Edge Function ships. Not a code defect; **operational** follow-up.

---

## UX / consistency (01-ui-spec.md)

| Requirement | Result |
|-------------|--------|
| Charts above purchase tables | ✅ Operator org purchases, operator machine **purchases** route, admin customer (purchases tab), admin machine page |
| Shared time controls; period vs table dates explained | ✅ Copy on operator org + admin pages |
| Hover tooltips; no table filtering from charts | ✅ `ChartTooltip` / `ChartTooltipContent`; descriptive copy in composites |
| Per-chart loading + error boundary + retry | ✅ `AnalyticsChartShell` + `AnalyticsChartErrorBoundary` |
| Admin `/dashboard` — platform charts only | ✅ |
| Admin customer/machine — org/machine charts only | ✅ |

**Finding U-1 (resolved)**  
Machine analytics and purchase log now live on a **single** operator route `/$orgSlug/machines/$machineId` (nested `/purchases` removed).

**Finding U-2 (P3)**  
Spec shows **Calendar in Popover**; apps use **`AnalyticsTimeControls`** with **`input type="date"`** (good keyboard/mobile; different from spec visuals).

**Finding U-3 (P3)**  
Spec mentions **zeros / copy for future periods** — verify product copy in empty/future edge cases during QA (not deeply audited here).

---

## Accessibility (01-ui-spec §6)

| Spec item | Result |
|-----------|--------|
| Logical focus order for time controls | ✅ Mostly native controls + buttons |
| Arrow keys inside charts | ⚠️ Default Recharts — do not assume full spec compliance |
| Visually hidden data tables / ARIA live on period change | ❌ Not observed in composites |
| WCAG contrast / color independence | ⚠️ Chart palette from design tokens — spot-check in theme |

**Finding A-1 (P3)**  
Treat strict a11y items in the UI spec as **follow-up** if you need formal WCAG sign-off.

---

## Checklist (ticket acceptance)

| AC | Status |
|----|--------|
| SEC-001–003 no unresolved **P0** gaps | ✅ (S-1 documented as P2 clarification) |
| FR-007 + UI: tooltip-first; no chart-driven table filters | ✅ |
| Berlin / hybrid MV + today | ✅ Code paths present; boundary correctness = QA with real data |
| T05 refresh | ⏸️ Deferred — not a code failure |

---

## Suggested follow-ups (non-blocking)

1. **S-1:** Decide and document admin-on-operator API behavior; tighten if needed.  
2. **P-1:** Staging `EXPLAIN` + note max latencies.  
3. **U-1:** Optional UX alignment — operator machine main page vs `/purchases` sub-route.  
4. **A-1:** Optional a11y hardening for chart data (table summary / `aria-live` on period change).  
5. **Ops:** Implement scheduled MV refresh (Supabase Edge Function) when ready.

---

## Files reviewed (representative)

- `apps/server/src/trpc/routers/operator-analytics.ts`  
- `apps/server/src/trpc/routers/admin-analytics.ts`  
- `apps/server/src/trpc/procedures.ts`  
- `apps/server/src/lib/org-scope.ts`  
- `apps/server/src/lib/analytics/build-org-dashboard.ts`  
- `packages/db/src/migrations/0000_analytics_purchase_daily_summary.sql`  
- `packages/ui/src/composite/analytics-dashboard.tsx`, `machine-analytics-dashboard.tsx`, `admin-platform-analytics-dashboard.tsx`, `analytics-chart-shell.tsx`  
- `apps/operator-frontend/.../purchases.tsx`, `.../$machineId.purchases.tsx`  
- `apps/admin-frontend/src/routes/_admin/dashboard.tsx`, `customers/$customerId/index.tsx`, `machines/$machineId.tsx`
