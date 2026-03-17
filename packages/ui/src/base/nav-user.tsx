"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@slushomat/ui/base/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@slushomat/ui/base/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@slushomat/ui/base/sidebar"
import { ChevronsUpDownIcon, LogOutIcon, UserXIcon } from "lucide-react"

export function NavUser({
  user,
  onSignOut,
  impersonated = false,
  onStopImpersonating,
}: {
  user: {
    name: string
    email: string
    avatar?: string
  }
  onSignOut: () => void | Promise<void>
  impersonated?: boolean
  onStopImpersonating?: () => void | Promise<void>
}) {
  const { isMobile } = useSidebar()
  const handleAction =
    impersonated && onStopImpersonating ? onStopImpersonating : onSignOut
  const actionLabel = impersonated ? "Stop impersonating" : "Sign out"
  const ActionIcon = impersonated ? UserXIcon : LogOutIcon

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>CN</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs">{user.email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => handleAction()}>
              <ActionIcon className="size-4" />
              {actionLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
