import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@slushomat/ui/base/breadcrumb";
import { Link, useLocation } from "@tanstack/react-router";
import { Fragment } from "react";

type Crumb = { label: string; to?: string };

const PATH_CRUMBS: Record<string, Crumb[]> = {
  "/": [{ label: "Dashboard" }],
  "/dashboard": [{ label: "Dashboard" }],
  "/users": [{ label: "Dashboard", to: "/dashboard" }, { label: "Users" }],
  "/customers": [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Customers" },
  ],
  "/contracts": [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Contracts" },
  ],
  "/machines": [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Machines" },
  ],
  "/create-customer": [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Customers", to: "/customers" },
    { label: "Create customer" },
  ],
};

export function AdminBreadcrumbs() {
  const { pathname } = useLocation();
  const items = PATH_CRUMBS[pathname] ?? [{ label: "Admin" }];

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
