import { authClient } from "@slushomat/auth/client";
import { AuthForm } from "@slushomat/ui/composite/auth-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

  return (
    <div className="flex min-h-[calc(100svh-theme(spacing.14))] items-center justify-center px-4">
      <AuthForm
        mode={mode}
        onModeToggle={() => setMode((m) => (m === "sign-in" ? "sign-up" : "sign-in"))}
        onSignIn={async (email, password) => {
          const { data, error } = await authClient.signIn.email({
            email,
            password,
            callbackURL: "/dashboard",
          });
          if (error) return { error: { message: error.message ?? "Sign in failed" } };
          if (data) navigate({ to: "/dashboard" });
          return {};
        }}
        onSignUp={async (email, password, name) => {
          const { data, error } = await authClient.signUp.email({
            email,
            password,
            name: name ?? "",
            callbackURL: "/dashboard",
          });
          if (error) return { error: { message: error.message ?? "Sign in failed" } };
          if (data) navigate({ to: "/dashboard" });
          return {};
        }}
      />
    </div>
  );
}
