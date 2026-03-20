import { authClient } from "@slushomat/auth/client";
import {
  BETTER_AUTH_FAILED_TO_CREATE_USER_CODE,
  BETTER_AUTH_USER_ALREADY_EXISTS_CODE,
} from "@slushomat/auth/auth-errors";
import { AuthForm } from "@slushomat/ui/composite/auth-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <AuthForm
        mode={mode}
        onModeToggle={() => setMode((m) => (m === "sign-in" ? "sign-up" : "sign-in"))}
        onSignUpError={(err) => {
          if (!err.message) return;
          if (err.code === BETTER_AUTH_FAILED_TO_CREATE_USER_CODE) {
            toast.error(err.message, {
              description:
                "Check server logs and the database (RLS, missing columns, or try the direct/session Postgres URL if the pooler rejects writes).",
              duration: 9000,
            });
            return;
          }
          if (err.code === BETTER_AUTH_USER_ALREADY_EXISTS_CODE) {
            toast.error(err.message, {
              description: "Try signing in if you already registered this email.",
              duration: 7000,
            });
            return;
          }
          toast.error(err.message);
        }}
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
          if (error) {
            const code =
              error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string"
                ? (error as { code: string }).code
                : undefined;
            return {
              error: {
                message: error.message ?? "Sign up failed",
                ...(code ? { code } : {}),
              },
            };
          }
          if (data) navigate({ to: "/dashboard" });
          return {};
        }}
      />
    </div>
  );
}
