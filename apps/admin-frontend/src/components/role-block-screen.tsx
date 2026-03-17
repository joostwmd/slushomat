/**
 * Shown when a signed-in user does not have admin role.
 * Static message, no self-service flow.
 */
export function RoleBlockScreen() {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center px-4"
      role="alert"
    >
      <h1 className="mb-2 text-lg font-medium">Access denied</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Your account does not have admin access. Contact your administrator to
        request admin privileges.
      </p>
    </div>
  );
}
