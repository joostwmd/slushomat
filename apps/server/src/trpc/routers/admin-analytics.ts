import { z } from "zod";
import {
  analyticsWindowFieldsSchema,
  toAnalyticsWindowInput,
} from "../../lib/analytics/analytics-window-schema";
import { resolveBerlinAnalyticsWindow } from "../../lib/analytics/berlin-range";
import { buildOrgDashboard } from "../../lib/analytics/build-org-dashboard";
import { buildPlatformDashboard } from "../../lib/analytics/build-platform-dashboard";
import { router } from "../init";
import { adminProcedure } from "../procedures";

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
    organizationId: z.string().min(1),
    machineId: z.string().optional(),
    businessEntityId: z.string().optional(),
  }),
);

const machineDashboardInputSchema = analyticsWindowFieldsSchema.and(
  z.object({
    organizationId: z.string().min(1),
    machineId: z.string().min(1),
  }),
);

const platformDashboardOutputSchema = z.object({
  meta: metaSchema,
  dailyTotals: z.array(dailyBucketSchema),
  topOrganizations: z.array(
    z.object({
      organizationId: z.string(),
      name: z.string(),
      grossCents: z.number(),
      purchaseCount: z.number(),
    }),
  ),
  machineTotals: z.array(machineSliceSchema),
  totalPlatformShareCents: z.number(),
});

const platformDashboardInputSchema = analyticsWindowFieldsSchema;

export const adminAnalyticsRouter = router({
  orgDashboard: adminProcedure
    .input(orgDashboardInputSchema)
    .output(orgDashboardOutputSchema)
    .query(async ({ ctx, input }) => {
      const range = await resolveBerlinAnalyticsWindow(
        ctx.db,
        toAnalyticsWindowInput(input),
      );

      return buildOrgDashboard(ctx.db, {
        organizationId: input.organizationId,
        range,
        machineId: input.machineId,
        businessEntityId: input.businessEntityId,
        machineScope: false,
      });
    }),

  machineDashboard: adminProcedure
    .input(machineDashboardInputSchema)
    .output(orgDashboardOutputSchema)
    .query(async ({ ctx, input }) => {
      const range = await resolveBerlinAnalyticsWindow(
        ctx.db,
        toAnalyticsWindowInput(input),
      );

      return buildOrgDashboard(ctx.db, {
        organizationId: input.organizationId,
        range,
        machineId: input.machineId,
        machineScope: true,
      });
    }),

  platformDashboard: adminProcedure
    .input(platformDashboardInputSchema)
    .output(platformDashboardOutputSchema)
    .query(async ({ ctx, input }) => {
      const range = await resolveBerlinAnalyticsWindow(
        ctx.db,
        toAnalyticsWindowInput(input),
      );

      return buildPlatformDashboard(ctx.db, {
        range,
      });
    }),
});
