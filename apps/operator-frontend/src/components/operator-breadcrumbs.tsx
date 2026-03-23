import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@slushomat/ui/base/breadcrumb";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { Fragment, useMemo } from "react";

import { trpc } from "@/utils/trpc";

type Crumb = {
  label: string;
  to?: string;
  params?: { orgSlug: string };
};

const ORG_LIST: Crumb = { label: "Organizations", to: "/organizations" };

const SECTION_LABEL: Record<
  "dashboard" | "products" | "businesses" | "contracts" | "machines" | "purchases",
  string
> = {
  dashboard: "Dashboard",
  products: "Products",
  businesses: "Businesses",
  contracts: "Contracts",
  machines: "Machines",
  purchases: "Purchases",
};

function parseOrgScoped(pathname: string): {
  orgSlug: string;
  section: keyof typeof SECTION_LABEL;
  machineId: string | null;
} | null {
  const machinePurchases = pathname.match(
    /^\/([^/]+)\/machines\/([^/]+)\/purchases\/?$/,
  );
  if (machinePurchases) {
    return {
      orgSlug: machinePurchases[1]!,
      section: "machines",
      machineId: machinePurchases[2]!,
    };
  }
  const machineDetail = pathname.match(/^\/([^/]+)\/machines\/([^/]+)\/?$/);
  if (machineDetail) {
    return {
      orgSlug: machineDetail[1]!,
      section: "machines",
      machineId: machineDetail[2]!,
    };
  }
  const machinesList = pathname.match(/^\/([^/]+)\/machines\/?$/);
  if (machinesList) {
    return {
      orgSlug: machinesList[1]!,
      section: "machines",
      machineId: null,
    };
  }
  const simple = pathname.match(
    /^\/([^/]+)\/(dashboard|products|businesses|contracts|purchases)\/?$/,
  );
  if (simple) {
    return {
      orgSlug: simple[1]!,
      section: simple[2] as keyof typeof SECTION_LABEL,
      machineId: null,
    };
  }
  return null;
}

export function OperatorBreadcrumbs() {
  const { pathname } = useLocation();
  const scoped = useMemo(() => parseOrgScoped(pathname), [pathname]);

  const machineQuery = useQuery({
    ...trpc.operator.machine.get.queryOptions({
      orgSlug: scoped?.orgSlug ?? "",
      machineId: scoped?.machineId ?? "",
    }),
    enabled: !!scoped?.orgSlug && !!scoped?.machineId,
  });

  const items = useMemo((): Crumb[] => {
    if (pathname === "/organizations") {
      return [{ label: "Organizations" }];
    }
    if (pathname === "/invitations") {
      return [{ label: "Invitations" }];
    }

    if (scoped) {
      const { orgSlug, section, machineId } = scoped;
      const base: Crumb[] = [ORG_LIST];

      if (machineId) {
        const machineLabel = machineQuery.isPending
          ? "…"
          : machineQuery.isSuccess
            ? machineQuery.data.orgDisplayName
            : "Machine";

        return [
          ...base,
          {
            label: SECTION_LABEL.machines,
            to: "/$orgSlug/machines",
            params: { orgSlug },
          },
          { label: machineLabel },
        ];
      }

      return [...base, { label: SECTION_LABEL[section] }];
    }

    return [{ label: "Operator" }];
  }, [
    machineQuery.data?.orgDisplayName,
    machineQuery.isPending,
    machineQuery.isSuccess,
    pathname,
    scoped,
  ]);

  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem className="min-w-0 shrink">
                {isLast || !item.to ? (
                  <BreadcrumbPage className="truncate">{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="truncate"
                    render={
                      item.params ? (
                        <Link to={item.to} params={item.params} />
                      ) : (
                        <Link to={item.to} />
                      )
                    }
                  >
                    {item.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
