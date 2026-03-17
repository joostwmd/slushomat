"use client";

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
import { authClient } from "@slushomat/auth/client";
import { Link, useLocation } from "@tanstack/react-router";
import {
  FileTextIcon,
  UsersIcon,
  Building2Icon,
  WrenchIcon,
} from "lucide-react";

const NAV_ITEMS = [
  { title: "Users", url: "/users", icon: <UsersIcon /> },
  { title: "Customers", url: "/customers", icon: <Building2Icon /> },
  { title: "Contracts", url: "/contracts", icon: <FileTextIcon /> },
  { title: "Machines", url: "/machines", icon: <WrenchIcon /> },
] as const;

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function AdminAppSidebar({ user }: { user: SessionUser }) {
  const location = useLocation();

  const navUser = {
    name: user.name ?? "",
    email: user.email ?? "",
    avatar: user.image ?? undefined,
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.url;
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<Link to={item.url} />}
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
          onSignOut={async () => {
            await authClient.signOut();
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
