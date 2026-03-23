import { z } from "zod";
import { resolveBerlinRange } from "../../lib/analytics/berlin-range";
import { buildOrgDashboard } from "../../lib/analytics/build-org-dashboard";
import { buildPlatformDashboard } from "../../lib/analytics/build-platform-dashboard";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const analyticsModeSchema = z.enum(["day", "week", "month"]);

const metaSchema = z.object({
  mode: analyticsModeSchema,
  anchorDate: z.string(),
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

const orgDashboardInputSchema = z.object({
  organizationId: z.string().min(1),
  mode: analyticsModeSchema,
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  machineId: z.string().optional(),
  businessEntityId: z.string().optional(),
});

const machineDashboardInputSchema = z.object({
  organizationId: z.string().min(1),
  machineId: z.string().min(1),
  mode: analyticsModeSchema,
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

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

const platformDashboardInputSchema = z.object({
  mode: analyticsModeSchema,
  anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const adminAnalyticsRouter = router({
  orgDashboard: adminProcedure
    .input(orgDashboardInputSchema)
    .output(orgDashboardOutputSchema)
    .query(async ({ ctx, input }) => {
      const range = await resolveBerlinRange(
        ctx.db,
        input.mode,
        input.anchorDate,
      );

      return buildOrgDashboard(ctx.db, {
        organizationId: input.organizationId,
        mode: input.mode,
        anchorDate: input.anchorDate,
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
      const range = await resolveBerlinRange(
        ctx.db,
        input.mode,
        input.anchorDate,
      );

      return buildOrgDashboard(ctx.db, {
        organizationId: input.organizationId,
        mode: input.mode,
        anchorDate: input.anchorDate,
        range,
        machineId: input.machineId,
        machineScope: true,
      });
    }),

  platformDashboard: adminProcedure
    .input(platformDashboardInputSchema)
    .output(platformDashboardOutputSchema)
    .query(async ({ ctx, input }) => {
      const range = await resolveBerlinRange(
        ctx.db,
        input.mode,
        input.anchorDate,
      );

      return buildPlatformDashboard(ctx.db, {
        mode: input.mode,
        anchorDate: input.anchorDate,
        range,
      });
    }),
});
