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

type Crumb = { label: string; to?: string };

const DASH: Crumb = { label: "Dashboard", to: "/dashboard" };

/** Static routes under `/_admin` (browser pathname has no `/_admin` prefix). */
const STATIC_CRUMBS: Record<string, Crumb[]> = {
  "/": [{ label: "Dashboard" }],
  "/dashboard": [{ label: "Dashboard" }],
  "/users": [DASH, { label: "Users" }],
  "/customers": [DASH, { label: "Customers" }],
  "/customers/": [DASH, { label: "Customers" }],
  "/contracts": [DASH, { label: "Contracts" }],
  "/deployments": [DASH, { label: "Deployments" }],
  "/machines": [DASH, { label: "Machines" }],
  "/products": [DASH, { label: "Template products" }],
  "/create-customer": [DASH, { label: "Customers", to: "/customers" }, { label: "Create customer" }],
};

function shortId(id: string, head = 8, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

function normalizePath(pathname: string): string {
  if (pathname === "/customers") return "/customers/";
  return pathname;
}

function parseCustomerPaths(pathname: string): {
  customerId: string | null;
  machineId: string | null;
} {
  const machine = pathname.match(/^\/customers\/([^/]+)\/machines\/([^/]+)$/);
  if (machine) {
    return { customerId: machine[1]!, machineId: machine[2]! };
  }
  const customer = pathname.match(/^\/customers\/([^/]+)$/);
  if (customer && customer[1] !== "") {
    return { customerId: customer[1]!, machineId: null };
  }
  return { customerId: null, machineId: null };
}

function parseStandaloneMachineId(pathname: string): string | null {
  const m = pathname.match(/^\/machines\/([^/]+)$/);
  return m?.[1] ?? null;
}

export function AdminBreadcrumbs() {
  const { pathname } = useLocation();
  const norm = normalizePath(pathname);
  const { customerId, machineId } = parseCustomerPaths(pathname);
  const standaloneMachineId = parseStandaloneMachineId(pathname);

  const orgQuery = useQuery({
    ...trpc.admin.customer.get.queryOptions({
      organizationId: customerId ?? "",
    }),
    enabled: !!customerId,
  });

  const items = useMemo((): Crumb[] => {
    if (customerId) {
      const orgLabel = orgQuery.isPending
        ? "…"
        : (orgQuery.data?.name ?? shortId(customerId));
      const base: Crumb[] = [
        DASH,
        { label: "Customers", to: "/customers" },
        ...(machineId
          ? [
              { label: orgLabel, to: `/customers/${customerId}` },
              { label: `Machine ${shortId(machineId)}` },
            ]
          : [{ label: orgLabel }]),
      ];
      return base;
    }

    if (standaloneMachineId) {
      return [
        DASH,
        { label: "Machines", to: "/machines" },
        { label: `Machine ${shortId(standaloneMachineId)}` },
      ];
    }

    return STATIC_CRUMBS[norm] ?? STATIC_CRUMBS[pathname] ?? [{ label: "Admin" }];
  }, [
    customerId,
    machineId,
    norm,
    pathname,
    orgQuery.data?.name,
    orgQuery.isPending,
    standaloneMachineId,
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
                    render={<Link to={item.to} />}
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
