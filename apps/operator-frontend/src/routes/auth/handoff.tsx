import { authClient } from "@slushomat/auth/client";
import { buttonVariants } from "@slushomat/ui/base/button";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/auth/handoff")({
  component: HandoffPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: search.token as string | undefined,
  }),
});

function HandoffPage() {
  const [state, setState] = useState<"loading" | "error" | "redirecting">("loading");
  const navigate = useNavigate();
  const { token } = Route.useSearch();

  useEffect(() => {
    if (!token) {
      navigate({ to: "/sign-in" });
      return;
    }

    let cancelled = false;

    authClient.oneTimeToken
      .verify({ token })
      .then(async () => {
        if (cancelled) return;
        setState("redirecting");
        const { data: orgs } = await authClient.organization.list();
        const slug = orgs?.[0]?.slug;
        if (slug) {
          navigate({ to: "/$orgSlug/dashboard", params: { orgSlug: slug } });
        } else {
          navigate({ to: "/invitations" });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  if (!token) return null;

  if (state === "loading" || state === "redirecting") {
    return (
      <div className="flex min-h-[calc(100svh-theme(spacing.14))] flex-col items-center justify-center gap-2 px-4">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p>Signing in...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100svh-theme(spacing.14))] flex-col items-center justify-center gap-4 px-4">
      <div role="alert" className="flex flex-col items-center gap-4 text-center">
        <p className="text-destructive">This link has expired or is invalid.</p>
        <Link to="/sign-in" className={buttonVariants()}>
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
