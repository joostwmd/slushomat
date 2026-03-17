import { authClient } from "@slushomat/auth/client";
import { AuthForm } from "@slushomat/ui/composite/auth-form";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[calc(100svh-theme(spacing.14))] items-center justify-center px-4">
      <AuthForm
        mode="sign-in"
        onSignIn={async (email, password) => {
          const { data, error } = await authClient.signIn.email({
            email,
            password,
            callbackURL: "/",
          });
          if (error) return { error: { message: error.message ?? "Sign in failed" } };
          if (data) navigate({ to: "/" });
          return {};
        }}
      />
    </div>
  );
}
