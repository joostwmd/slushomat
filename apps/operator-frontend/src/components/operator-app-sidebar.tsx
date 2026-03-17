"use client";

import type React from "react";
import { authClient } from "@slushomat/auth/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@slushomat/ui/base/sidebar";
import { NavUser } from "@slushomat/ui/base/nav-user";
import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboardIcon, Building2Icon, MailIcon } from "lucide-react";

export function OperatorAppSidebar() {
  const location = useLocation();
  const session = authClient.useSession();
  const user = session.data?.user;
  const activeSlug = (session.data?.session as { activeOrganizationSlug?: string } | undefined)
    ?.activeOrganizationSlug;
  const impersonated = !!(session.data?.session as { impersonatedBy?: string } | undefined)
    ?.impersonatedBy;

  if (!user) return null;

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

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operator</SidebarGroupLabel>
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
