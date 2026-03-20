"use client";

import { useState } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@slushomat/ui/base/avatar";
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
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { getAdminOrgBrand } from "@/config/admin-brand";
import { authClient } from "@slushomat/auth/client";
import { Link, useLocation } from "@tanstack/react-router";
import {
  FileTextIcon,
  UsersIcon,
  Building2Icon,
  WrenchIcon,
  PackageIcon,
  TruckIcon,
} from "lucide-react";

const NAV_ITEMS = [
  { title: "Users", url: "/users", icon: <UsersIcon /> },
  { title: "Customers", url: "/customers", icon: <Building2Icon /> },
  { title: "Contracts", url: "/contracts", icon: <FileTextIcon /> },
  { title: "Deployments", url: "/deployments", icon: <TruckIcon /> },
  { title: "Machines", url: "/machines", icon: <WrenchIcon /> },
  { title: "Products", url: "/products", icon: <PackageIcon /> },
] as const;

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function AdminAppSidebar({ user }: { user: SessionUser }) {
  const location = useLocation();
  const org = getAdminOrgBrand();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const navUser = {
    name: user.name ?? "",
    email: user.email ?? "",
    avatar: user.image ?? undefined,
  };

  return (
    <>
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link to="/dashboard" />}
                tooltip={{ children: org.name }}
              >
                <Avatar className="size-8 rounded-lg">
                  {org.logoUrl ? (
                    <AvatarImage src={org.logoUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                    {org.initial}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{org.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {org.subtitle}
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
                const isActive =
                  location.pathname === item.url ||
                  (item.url === "/customers" &&
                    (location.pathname === "/customers/" ||
                      location.pathname.startsWith("/customers/")));
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
            onChangePassword={() => setChangePasswordOpen(true)}
          />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </>
  );
}
