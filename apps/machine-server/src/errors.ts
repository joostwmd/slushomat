/**
 * Machine server specific error codes.
 * Use these when rejecting requests due to machine auth or machine state.
 */

export const MACHINE_ERROR_CODES = {
  INVALID_MACHINE_CREDENTIALS: "INVALID_MACHINE_CREDENTIALS",
  MACHINE_DISABLED: "MACHINE_DISABLED",
} as const;
