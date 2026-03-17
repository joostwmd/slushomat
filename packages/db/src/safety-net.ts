import { DrizzleQueryError } from "drizzle-orm";
import { DatabaseError as PgDatabaseError } from "pg";

import {
  CheckViolationError,
  ConnectionError,
  DatabaseError,
  DeadlockError,
  ForeignKeyViolationError,
  InvalidInputError,
  NotNullViolationError,
  QueryTimeoutError,
  SerializationError,
  UniqueViolationError,
} from "./errors";

/** Node.js system error codes that indicate connection loss. */
const CONNECTION_SYSTEM_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ENETUNREACH",
]);

function parseConstraintDetail(detail?: string): {
  column?: string;
  value?: string;
} {
  if (!detail) return {};
  const match = detail.match(/Key \((.+?)\)=\((.+?)\)/);
  return { column: match?.[1], value: match?.[2] };
}

/**
 * Extracts the Postgres error from a caught error. Drizzle wraps driver errors in
 * DrizzleQueryError with the original error in `cause`. For node-postgres (pg), the
 * cause is DatabaseError with `.code`, `.detail`, `.column`, `.constraint`.
 *
 * Also handles Node SystemError (ECONNRESET etc.) when connection is lost.
 */
function extractPgError(err: unknown): {
  code?: string;
  detail?: string;
  column?: string;
  constraint?: string;
  message?: string;
} | null {
  // DrizzleQueryError wraps the driver error in .cause (pg.DatabaseError for node-postgres)
  if (err instanceof DrizzleQueryError && err.cause) {
    const cause = err.cause;
    if (cause instanceof PgDatabaseError) {
      return {
        code: cause.code,
        detail: cause.detail,
        column: cause.column,
        constraint: cause.constraint,
        message: cause.message,
      };
    }
    // SystemError (ECONNRESET, etc.) - err.cause may be generic Error with .code
    if (cause instanceof Error && "code" in cause) {
      const sysErr = cause as Error & { code?: string };
      if (CONNECTION_SYSTEM_CODES.has(sysErr.code ?? "")) {
        return { code: sysErr.code, message: sysErr.message };
      }
    }
  }

  // Direct pg.DatabaseError (if Drizzle doesn't wrap in some paths)
  if (err instanceof PgDatabaseError) {
    return {
      code: err.code,
      detail: err.detail,
      column: err.column,
      constraint: err.constraint,
      message: err.message,
    };
  }

  // Fallback: error has .code (e.g. from other drivers or older Drizzle)
  if (err && typeof err === "object" && "code" in err) {
    const e = err as {
      code?: string;
      detail?: string;
      column?: string;
      message?: string;
    };
    return {
      code: e.code,
      detail: e.detail,
      column: e.column,
      message: e.message,
    };
  }

  return null;
}

/**
 * Wraps a DB operation and maps PG errors to domain errors. Drizzle throws
 * DrizzleQueryError with the underlying pg.DatabaseError in error.cause.
 *
 * Use for standalone tx usage; inside withTransaction it's applied automatically.
 */
export async function dbSafe<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err: unknown) {
    const e = extractPgError(err);

    if (!e) {
      throw err;
    }

    const pgCode = e.code;

    switch (pgCode) {
      case "23505": {
        const { column, value } = parseConstraintDetail(e.detail);
        throw new UniqueViolationError(
          column
            ? `A record with this ${column} already exists`
            : "Duplicate record",
          column,
          value,
          err,
        );
      }
      case "23503":
        throw new ForeignKeyViolationError(
          "Referenced record does not exist",
          err,
        );
      case "23502":
        throw new NotNullViolationError(
          `Missing required field: ${e.column ?? "unknown"}`,
          e.column ?? "unknown",
          err,
        );
      case "23514":
        throw new CheckViolationError(
          "Data validation failed at database level",
          err,
        );
      case "22P02":
        throw new InvalidInputError(
          e.message ?? "Invalid input syntax (e.g. wrong type for column)",
          err,
        );
      case "40001":
        throw new SerializationError(err);
      case "40P01":
        throw new DeadlockError(err);
      case "57014":
        throw new QueryTimeoutError(err);
      case "08006":
      case "08003":
      case "08001":
      case "53300":
        throw new ConnectionError("Database connection lost", err);
      default:
        // System errors (ECONNRESET etc.)
        if (pgCode && CONNECTION_SYSTEM_CODES.has(pgCode)) {
          throw new ConnectionError(
            `Database connection lost: ${e.message ?? pgCode}`,
            err,
          );
        }
        if (pgCode) {
          throw new DatabaseError(
            `Database error (code: ${pgCode})`,
            pgCode,
            err,
          );
        }
        throw err;
    }
  }
}
