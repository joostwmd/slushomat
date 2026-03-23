import { Button } from "@slushomat/ui/base/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@slushomat/ui/base/empty";
import { Skeleton } from "@slushomat/ui/base/skeleton";
import { ChartNoAxesCombined } from "lucide-react";
import * as React from "react";

export type AnalyticsChartShellProps = {
  chartId: string;
  title: string;
  description?: string;
  loading?: boolean;
  /** When true (and not loading), show empty state instead of the chart. */
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRetry?: (chartId: string) => void;
  children: React.ReactNode;
};

/** Per-chart error isolation + loading skeleton (FR-008, Failure State 2). */
export class AnalyticsChartErrorBoundary extends React.Component<
  {
    chartId: string;
    title: string;
    onRetry?: (chartId: string) => void;
    children: React.ReactNode;
  },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-none border border-border bg-muted/20 p-4 text-center"
          role="alert"
        >
          <p className="text-xs text-muted-foreground">
            Could not render “{this.props.title}”.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              this.props.onRetry?.(this.props.chartId);
              this.setState({ error: null });
            }}
          >
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function AnalyticsChartShell({
  chartId,
  title,
  description,
  loading,
  empty = false,
  emptyTitle = "Not enough data",
  emptyDescription = "Nothing recorded for this time range. Try another period or check back later.",
  onRetry,
  children,
}: AnalyticsChartShellProps) {
  return (
    <Card size="sm" className="h-full min-h-0">
      <CardHeader className="border-b border-border pb-3">
        <CardTitle>{title}</CardTitle>
        {description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <Skeleton className="aspect-video w-full max-h-[280px]" />
        ) : empty ? (
          <Empty className="min-h-[240px] justify-center">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ChartNoAxesCombined />
              </EmptyMedia>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <AnalyticsChartErrorBoundary
            chartId={chartId}
            title={title}
            onRetry={onRetry}
          >
            {children}
          </AnalyticsChartErrorBoundary>
        )}
      </CardContent>
    </Card>
  );
}
