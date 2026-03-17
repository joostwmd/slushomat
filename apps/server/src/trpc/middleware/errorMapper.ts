import { TRPCError } from "@trpc/server";
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
} from "@slushomat/db";
import { middleware } from "../init";

export const errorMapperMiddleware = middleware(async ({ next }) => {
  try {
    return await next();
  } catch (err) {
    if (err instanceof TRPCError) throw err;

    if (err instanceof UniqueViolationError) {
      throw new TRPCError({
        code: "CONFLICT",
        message: err.message,
        cause: err,
      });
    }

    if (err instanceof ForeignKeyViolationError) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Referenced record does not exist",
        cause: err,
      });
    }

    if (err instanceof NotNullViolationError) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: err.message,
        cause: err,
      });
    }

    if (err instanceof CheckViolationError) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Data validation failed at database level",
        cause: err,
      });
    }

    if (err instanceof InvalidInputError) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: err.message,
        cause: err,
      });
    }

    if (err instanceof SerializationError || err instanceof DeadlockError) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Transaction conflict — please retry",
        cause: err,
      });
    }

    if (err instanceof QueryTimeoutError) {
      throw new TRPCError({
        code: "TIMEOUT",
        message: "Database query timed out",
        cause: err,
      });
    }

    if (err instanceof ConnectionError || err instanceof DatabaseError) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "A database error occurred",
        cause: err,
      });
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      cause: err,
    });
  }
});
