import { z } from "zod";
import {
  assertUserMemberOfOrg,
  getOrganizationIdForSlug,
} from "../../lib/org-scope";
import {
  analyticsWindowFieldsSchema,
  toAnalyticsWindowInput,
} from "../../lib/analytics/analytics-window-schema";
import { resolveBerlinAnalyticsWindow } from "../../lib/analytics/berlin-range";
import { buildOrgDashboard } from "../../lib/analytics/build-org-dashboard";
import { router } from "../init";
import { operatorProcedure } from "../procedures";

const metaSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  berlinToday: z.string(),
  usedMaterializedView: z.boolean(),
  degraded: z.boolean(),
});

const dailyBucketSchema = z.object({
  date: z.string(),
  grossCents: z.number(),
  purchaseCount: z.number(),
  platformShareCents: z.number(),
});

const productDaySchema = z.object({
  operatorProductId: z.string(),
  productName: z.string(),
  date: z.string(),
  grossCents: z.number(),
  purchaseCount: z.number(),
});

const machineSliceSchema = z.object({
  machineId: z.string(),
  label: z.string(),
  grossCents: z.number(),
  purchaseCount: z.number(),
});

const entitySliceSchema = z.object({
  businessEntityId: z.string(),
  name: z.string(),
  grossCents: z.number(),
  purchaseCount: z.number(),
});

const monthlyFinancialSchema = z.object({
  monthStart: z.string(),
  grossCents: z.number(),
  platformShareCents: z.number(),
  rentCents: z.number(),
});

const orgDashboardOutputSchema = z.object({
  meta: metaSchema,
  dailyTotals: z.array(dailyBucketSchema),
  productByDay: z.array(productDaySchema),
  machineTotals: z.array(machineSliceSchema),
  entityTotals: z.array(entitySliceSchema),
  monthlyFinancials: z.array(monthlyFinancialSchema),
});

const orgDashboardInputSchema = analyticsWindowFieldsSchema.and(
  z.object({
    orgSlug: z.string().min(1),
    machineId: z.string().optional(),
    businessEntityId: z.string().optional(),
  }),
);

const machineDashboardInputSchema = analyticsWindowFieldsSchema.and(
  z.object({
    orgSlug: z.string().min(1),
    machineId: z.string().min(1),
  }),
);

export const operatorAnalyticsRouter = router({
  orgDashboard: operatorProcedure
    .input(orgDashboardInputSchema)
    .output(orgDashboardOutputSchema)
    .query(async ({ ctx, input }) => {
      const organizationId = await getOrganizationIdForSlug(
        ctx.db,
        input.orgSlug,
      );
      await assertUserMemberOfOrg(ctx.db, ctx.user.id, organizationId);

      const range = await resolveBerlinAnalyticsWindow(
        ctx.db,
        toAnalyticsWindowInput(input),
      );

      return buildOrgDashboard(ctx.db, {
        organizationId,
        range,
        machineId: input.machineId,
        businessEntityId: input.businessEntityId,
        machineScope: false,
      });
    }),

  machineDashboard: operatorProcedure
    .input(machineDashboardInputSchema)
    .output(orgDashboardOutputSchema)
    .query(async ({ ctx, input }) => {
      const organizationId = await getOrganizationIdForSlug(
        ctx.db,
        input.orgSlug,
      );
      await assertUserMemberOfOrg(ctx.db, ctx.user.id, organizationId);

      const range = await resolveBerlinAnalyticsWindow(
        ctx.db,
        toAnalyticsWindowInput(input),
      );

      return buildOrgDashboard(ctx.db, {
        organizationId,
        range,
        machineId: input.machineId,
        machineScope: true,
      });
    }),
});
