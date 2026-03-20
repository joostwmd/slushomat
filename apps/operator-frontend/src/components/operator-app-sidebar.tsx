"use client";

import type React from "react";
import { authClient } from "@slushomat/auth/client";
import { Avatar, AvatarFallback } from "@slushomat/ui/base/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@slushomat/ui/base/sidebar";
import { NavUser } from "@slushomat/ui/base/nav-user";
import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboardIcon, Building2Icon, MailIcon } from "lucide-react";

export function OperatorAppSidebar() {
  const location = useLocation();
  const session = authClient.useSession();
  const user = session.data?.user;
  const activeSlug = (session.data?.session as { activeOrganizationSlug?: string } | undefined)
    ?.activeOrganizationSlug;
  const impersonated = !!(session.data?.session as { impersonatedBy?: string } | undefined)
    ?.impersonatedBy;

  const { data: orgs } = useQuery({
    queryKey: ["organization", "list"],
    queryFn: async () => {
      const { data } = await authClient.organization.list();
      return data ?? [];
    },
    enabled: !!user,
  });

  if (!user) return null;

  type OrgRow = { slug: string; name?: string | null };
  const activeOrg = (orgs as OrgRow[] | undefined)?.find(
    (o) => o.slug === activeSlug,
  );
  const brandName = activeOrg?.name?.trim() || "Slushomat";
  const brandInitial = brandName.charAt(0).toUpperCase() || "S";

  const navUser = {
    name: user.name ?? "",
    email: user.email ?? "",
    avatar: (user as { image?: string }).image,
  };

  const NAV_ITEMS: Array<{
    title: string;
    to: "/organizations" | "/invitations" | "/$orgSlug/dashboard";
    params?: { orgSlug: string };
    icon: React.ReactNode;
  }> = [
    {
      title: "Dashboard",
      to: activeSlug ? "/$orgSlug/dashboard" : "/organizations",
      params: activeSlug ? { orgSlug: activeSlug } : undefined,
      icon: <LayoutDashboardIcon />,
    },
    { title: "Organizations", to: "/organizations", icon: <Building2Icon /> },
    { title: "Invitations", to: "/invitations", icon: <MailIcon /> },
  ];

  const homeLink =
    activeSlug != null && activeSlug !== "" ? (
      <Link to="/$orgSlug/dashboard" params={{ orgSlug: activeSlug }} />
    ) : (
      <Link to="/organizations" />
    );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={homeLink}
              tooltip={{ children: brandName }}
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                  {brandInitial}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{brandName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  Operator
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const path = item.params
                ? `/${item.params.orgSlug}/dashboard`
                : item.to;
              const isActive =
                location.pathname === path ||
                (path !== "/" && location.pathname.startsWith(path));
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={
                      <Link to={item.to} params={item.params} />
                    }
                    tooltip={item.title}
                    isActive={isActive}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={navUser}
          onSignOut={() => {
            void authClient.signOut();
          }}
          impersonated={impersonated}
          onStopImpersonating={() => {
            void authClient.admin.stopImpersonating();
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
