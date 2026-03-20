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

function crumbsForPath(pathname: string): Crumb[] {
  if (pathname === "/organizations") {
    return [{ label: "Organizations" }];
  }
  if (pathname === "/invitations") {
    return [{ label: "Invitations" }];
  }
  if (/^\/[^/]+\/dashboard$/.test(pathname)) {
    return [
      { label: "Organizations", to: "/organizations" },
      { label: "Dashboard" },
    ];
  }
  return [{ label: "Operator" }];
}

export function OperatorBreadcrumbs() {
  const { pathname } = useLocation();
  const items = crumbsForPath(pathname);

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
