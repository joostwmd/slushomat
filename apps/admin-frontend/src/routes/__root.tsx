import { Toaster } from "@slushomat/ui/base/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeadContent, Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

import Loader from "@/components/loader";
import { ThemeProvider } from "@/components/theme-provider";
import type { trpc } from "@/utils/trpc";

import "../index.css";

export interface RouterAppContext {
  trpc: typeof trpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  pendingComponent: Loader,
  head: () => ({
    meta: [
      { title: "Slushomat Admin" },
      { name: "description", content: "Slushomat Admin Dashboard" },
    ],
    links: [{ rel: "icon", href: "/favicon.ico" }],
  }),
});

function RootComponent() {
  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="admin-ui-theme"
      >
        <div className="grid h-svh grid-rows-[auto_1fr]">
          <header className="border-b px-4 py-2">
            <span className="font-medium">Slushomat Admin</span>
          </header>
          <main>
            <Outlet />
          </main>
        </div>
        <Toaster richColors />
      </ThemeProvider>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </>
  );
}
