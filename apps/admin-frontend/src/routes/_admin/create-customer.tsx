/**
 * Create Customer wizard — two-step flow per 01-ui-spec.md.
 * Step 1: authClient.admin.createUser
 * Step 2: trpc.admin.createOrganization
 */
import { Button, buttonVariants } from "@slushomat/ui/base/button";
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
import { authClient } from "@slushomat/auth/client";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@slushomat/ui/lib/utils";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_admin/create-customer")({
  component: () => <CreateCustomerWizard />,
});

type CreateCustomerWizardProps = {
  /** For UT-03, UT-04: render step 2 directly without completing step 1 */
  initialStep?: 1 | 2;
};

const STEP2_PLACEHOLDER_USER = {
  id: "_test",
  email: "test@example.com",
  name: "Test User",
} as const;

export function CreateCustomerWizard({ initialStep = 1 }: CreateCustomerWizardProps) {
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(
    initialStep === 2 ? STEP2_PLACEHOLDER_USER : null
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ userName: string; orgName: string } | null>(
    null
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgLogo, setOrgLogo] = useState("");
  const [orgMetadata, setOrgMetadata] = useState("");

  const createOrganizationMutation = useMutation(
    trpc.admin.createOrganization.mutationOptions()
  );

  const loading = createOrganizationMutation.isPending;

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!trimmedEmail || !password || !trimmedName) {
      setError("Email, password, and name are required.");
      return;
    }

    try {
      const res = (await authClient.admin.createUser({
        email: trimmedEmail,
        password,
        name: trimmedName,
        role: "user",
      })) as unknown as {
        data?: { user?: { id: string } };
        user?: { id: string };
        error?: { message?: string };
      };

      // API returns { user: { id, ... } }; client may wrap as data or pass through
      const newUser = res?.data?.user ?? res?.user;
      if (!newUser?.id) {
        setError(res?.error?.message ?? "Failed to create user. No user ID returned.");
        return;
      }

      setUser({
        id: newUser.id,
        email: trimmedEmail,
        name: trimmedName,
      });
      setStep(2);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || "Failed to create user");
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);

    const trimmedOrgName = orgName.trim();
    const trimmedSlug = orgSlug.trim();

    if (!trimmedOrgName || !trimmedSlug) {
      setError("Organization name and slug are required.");
      return;
    }

    let metadataObj: Record<string, unknown> | undefined;
    if (orgMetadata.trim()) {
      try {
        metadataObj = JSON.parse(orgMetadata) as Record<string, unknown>;
      } catch {
        setError("Metadata must be valid JSON.");
        return;
      }
    }

    createOrganizationMutation.mutate(
      {
        name: trimmedOrgName,
        slug: trimmedSlug,
        logo: orgLogo.trim() || undefined,
        metadata: metadataObj,
        userId: user.id,
      },
      {
        onSuccess: (res) => {
          setSuccess({ userName: user.name, orgName: res.name });
        },
        onError: (err) => {
          setError(err.message ?? "Failed to create organization");
        },
      }
    );
  };

  const resetWizard = () => {
    setStep(1);
    setUser(null);
    setSuccess(null);
    setError(null);
    setEmail("");
    setPassword("");
    setName("");
    setOrgName("");
    setOrgSlug("");
    setOrgLogo("");
    setOrgMetadata("");
  };

  const [step1LoadingState, setStep1LoadingState] = useState(false);

  const handleStep1WithLoading = async (e: React.FormEvent) => {
    setStep1LoadingState(true);
    try {
      await handleStep1Submit(e);
    } finally {
      setStep1LoadingState(false);
    }
  };

  if (success) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-4 text-xl font-medium">Create customer</h1>
        <Card>
          <CardHeader>
            <CardTitle>Success</CardTitle>
            <CardDescription>
              Customer created: {success.userName} / {success.orgName}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex gap-2">
            <Link
              to="/dashboard"
              className={cn(buttonVariants(), "inline-flex")}
            >
              Go to dashboard
            </Link>
            <Button variant="outline" onClick={resetWizard}>
              Create another customer
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-xl font-medium">Create customer</h1>

      <div
        className="mb-4 flex gap-2 text-sm"
        role="list"
        aria-label="Steps"
      >
        <span
          className={step === 1 ? "font-medium" : "text-muted-foreground"}
          aria-current={step === 1 ? "step" : undefined}
        >
          1. User {step === 2 && "✓"}
        </span>
        <span aria-hidden>—</span>
        <span
          className={step === 2 ? "font-medium" : "text-muted-foreground"}
          aria-current={step === 2 ? "step" : undefined}
        >
          2. Organization
        </span>
      </div>

      {step === 1 && (
        <Card>
          <form
            onSubmit={handleStep1WithLoading}
            aria-busy={step1LoadingState}
            noValidate
          >
            <CardHeader>
              <CardTitle>Create user</CardTitle>
              <CardDescription>
                Enter email, password, and name for the new user.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="step1-email">Email</Label>
                <Input
                  id="step1-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={step1LoadingState}
                  aria-invalid={!!error}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="step1-password">Password</Label>
                <Input
                  id="step1-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={step1LoadingState}
                  aria-invalid={!!error}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="step1-name">Name</Label>
                <Input
                  id="step1-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  disabled={step1LoadingState}
                  aria-invalid={!!error}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                disabled={step1LoadingState}
                className="w-full"
              >
                {step1LoadingState ? "Please wait..." : "Create user & continue"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {step === 2 && user && (
        <Card>
          <form
            onSubmit={handleStep2Submit}
            aria-busy={loading}
            noValidate
          >
            <CardHeader>
              <CardTitle>Create organization</CardTitle>
              <CardDescription>
                Set up the organization for this user.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                User: {user.email} ({user.name})
              </p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="step2-name">Organization name</Label>
                <Input
                  id="step2-name"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  disabled={loading}
                  aria-invalid={!!error}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="step2-slug">Slug</Label>
                <Input
                  id="step2-slug"
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  required
                  disabled={loading}
                  aria-invalid={!!error}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="step2-logo">Logo (optional)</Label>
                <Input
                  id="step2-logo"
                  type="url"
                  value={orgLogo}
                  onChange={(e) => setOrgLogo(e.target.value)}
                  placeholder="https://..."
                  disabled={loading}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="step2-metadata">Metadata (optional JSON)</Label>
                <textarea
                  id="step2-metadata"
                  value={orgMetadata}
                  onChange={(e) => setOrgMetadata(e.target.value)}
                  disabled={loading}
                  placeholder='{"key": "value"}'
                  rows={3}
                  className="flex min-h-[60px] w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? "Please wait..." : "Create organization"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}
