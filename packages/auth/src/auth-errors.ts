/** Machine-readable Better Auth / HTTP error body `code` for admin self-service sign-up. */
export const ADMIN_EMAIL_DOMAIN_NOT_ALLOWED_CODE = "ADMIN_EMAIL_DOMAIN_NOT_ALLOWED";

export const ADMIN_EMAIL_DOMAIN_NOT_ALLOWED_MESSAGE =
  "Only @code.berlin email addresses can register for the admin dashboard.";

/** Better Auth `POST /sign-up/email` → 422 when the email is already registered. */
export const BETTER_AUTH_USER_ALREADY_EXISTS_CODE = "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";

/** Better Auth `POST /sign-up/email` → 422 when the DB insert fails (see server logs for the real cause). */
export const BETTER_AUTH_FAILED_TO_CREATE_USER_CODE = "FAILED_TO_CREATE_USER";
