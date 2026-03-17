import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/$orgSlug/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$orgSlug/dashboard",
      params: { orgSlug: params.orgSlug },
      throw: true,
    });
  },
  component: () => null,
});
