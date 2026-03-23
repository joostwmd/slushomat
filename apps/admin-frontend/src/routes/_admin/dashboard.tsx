import { buttonVariants } from "@slushomat/ui/base/button";
import { AdminPlatformAnalyticsDashboard } from "@slushomat/ui/composite/admin-platform-analytics-dashboard";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@slushomat/ui/lib/utils";

import {
  AnalyticsTimeControls,
  localTodayIsoDate,
  type AnalyticsPeriod,
} from "@/components/analytics-time-controls";
import {
  allChartsLoading,
  emptyAdminPlatformData,
  PLATFORM_CHART_IDS,
} from "@/lib/analytics-empty-data";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_admin/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>(() => ({
    mode: "week",
    anchorDate: localTodayIsoDate(),
  }));

  const platformQuery = useQuery(
    trpc.admin.analytics.platformDashboard.queryOptions({
      mode: period.mode,
      anchorDate: period.anchorDate,
    }),
  );

  const platformData = platformQuery.data
    ? {
        dailyTotals: platformQuery.data.dailyTotals,
        topOrganizations: platformQuery.data.topOrganizations,
        machineTotals: platformQuery.data.machineTotals,
        totalPlatformShareCents: platformQuery.data.totalPlatformShareCents,
      }
    : emptyAdminPlatformData;

  const lastUpdated = platformQuery.data
    ? new Intl.DateTimeFormat("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date())
    : undefined;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-xl font-medium">Admin dashboard</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Platform-wide analytics (Europe/Berlin calendar periods). Customer pages
        show org-scoped charts only.
      </p>

      <div className="mb-8 flex flex-wrap gap-2">
        <Link
          to="/users"
          className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}
        >
          Users
        </Link>
        <Link
          to="/create-customer"
          className={cn(buttonVariants(), "inline-flex")}
        >
          Create customer
        </Link>
      </div>

      {platformQuery.isError ? (
        <p className="mb-4 text-sm text-destructive">
          Could not load platform analytics.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void platformQuery.refetch()}
          >
            Retry
          </button>
        </p>
      ) : null}
      {platformQuery.data?.meta.degraded ? (
        <p className="mb-4 text-xs text-amber-700 dark:text-amber-400">
          Live purchase data only — daily summary view is temporarily
          unavailable.
        </p>
      ) : null}

      <AdminPlatformAnalyticsDashboard
        data={platformData}
        headerSlot={
          <AnalyticsTimeControls
            idPrefix="admin-platform"
            value={period}
            onChange={setPeriod}
          />
        }
        lastUpdated={lastUpdated}
        chartLoading={allChartsLoading(
          PLATFORM_CHART_IDS,
          platformQuery.isFetching && !platformQuery.data,
        )}
        onChartRetry={() => void platformQuery.refetch()}
      />
    </div>
  );
}
