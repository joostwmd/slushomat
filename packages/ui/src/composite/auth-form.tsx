"use client";

import * as React from "react";

import { Button } from "@slushomat/ui/base/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@slushomat/ui/base/card";
import { Input } from "@slushomat/ui/base/input";
import { Label } from "@slushomat/ui/base/label";

export interface AuthFormProps {
  mode: "sign-in" | "sign-up";
  onModeToggle?: () => void;
  onSignIn: (email: string, password: string) => Promise<{ error?: { message: string } }>;
  onSignUp?: (email: string, password: string, name?: string) => Promise<{ error?: { message: string } }>;
  isLoading?: boolean;
  defaultEmail?: string;
}

export function AuthForm({
  mode,
  onModeToggle,
  onSignIn,
  onSignUp,
  isLoading = false,
  defaultEmail,
}: AuthFormProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const showSignUp = Boolean(onSignUp && onModeToggle);
  const isSignUp = showSignUp && mode === "sign-up";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement)?.value;
    const password = (form.elements.namedItem("password") as HTMLInputElement)?.value;
    const name = (form.elements.namedItem("name") as HTMLInputElement)?.value;

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setSubmitting(true);
    try {
      const result = isSignUp
        ? await onSignUp!(email, password, name || undefined)
        : await onSignIn(email, password);
      if (result?.error) {
        setError(result.error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleModeToggle = () => {
    setError(null);
    onModeToggle?.();
  };

  const disabled = isLoading || submitting;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isSignUp ? "Create an account" : "Sign in"}</CardTitle>
        <CardDescription>
          {isSignUp
            ? "Enter your details to create an account."
            : "Enter your credentials to sign in."}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit} aria-busy={disabled} aria-describedby={error ? "auth-error" : undefined}>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p
              id="auth-error"
              className="text-xs text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
          {isSignUp && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                disabled={disabled}
                aria-invalid={false}
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete={isSignUp ? "email" : "email"}
              placeholder="you@example.com"
              defaultValue={defaultEmail}
              disabled={disabled}
              required
              aria-invalid={!!error}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder="••••••••"
              disabled={disabled}
              required
              minLength={8}
              aria-invalid={!!error}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" disabled={disabled} className="w-full">
            {disabled ? "Please wait..." : isSignUp ? "Sign up" : "Sign in"}
          </Button>
          {showSignUp && (
            <button
              type="button"
              onClick={handleModeToggle}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}
