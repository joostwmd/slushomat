# Test specification: Enhanced Analytics Dashboard (`enhanced-analytics-dashboard`)

## Status

**Explicitly out of scope for this feature** — the stakeholder chose not to add automated tests in this iteration.

## Rationale

- Discovery completed without a separate test-strategist pass.
- Implementation may still be validated manually (see human checkpoints in `03-plan.md`).

## If tests are added later (optional backlog)

| Area | Suggested type | Notes |
|------|----------------|--------|
| tRPC analytics procedures | Integration | Org scoping, admin vs operator, machine scoping |
| MV + “today” merge | Integration | No double-count; CET boundaries; DST edge |
| Chart data shapes | Unit | Pure transforms from API DTO → Recharts series |

This file exists so the `/plan` workflow precondition (`02-test-spec.md` present) is satisfied without implying committed test work.
