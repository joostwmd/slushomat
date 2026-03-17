/**
 * Domain errors for the database layer. Mapped from PG codes in dbSafe;
 * consumed by tRPC errorMapperMiddleware.
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DatabaseError";
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

export class UniqueViolationError extends DatabaseError {
  constructor(
    message: string,
    public readonly column?: string,
    public readonly value?: string,
    cause?: unknown,
  ) {
    super(message, "23505", cause);
    this.name = "UniqueViolationError";
    Object.setPrototypeOf(this, UniqueViolationError.prototype);
  }
}

export class ForeignKeyViolationError extends DatabaseError {
  constructor(message: string, cause?: unknown) {
    super(message, "23503", cause);
    this.name = "ForeignKeyViolationError";
    Object.setPrototypeOf(this, ForeignKeyViolationError.prototype);
  }
}

export class NotNullViolationError extends DatabaseError {
  constructor(
    message: string,
    public readonly column: string,
    cause?: unknown,
  ) {
    super(message, "23502", cause);
    this.name = "NotNullViolationError";
    Object.setPrototypeOf(this, NotNullViolationError.prototype);
  }
}

export class CheckViolationError extends DatabaseError {
  constructor(message: string, cause?: unknown) {
    super(message, "23514", cause);
    this.name = "CheckViolationError";
    Object.setPrototypeOf(this, CheckViolationError.prototype);
  }
}

/** Invalid input syntax (e.g. number in string column, malformed UUID). */
export class InvalidInputError extends DatabaseError {
  constructor(message: string, cause?: unknown) {
    super(message, "22P02", cause);
    this.name = "InvalidInputError";
    Object.setPrototypeOf(this, InvalidInputError.prototype);
  }
}

export class SerializationError extends DatabaseError {
  constructor(cause?: unknown) {
    super("Serialization failure", "40001", cause);
    this.name = "SerializationError";
    Object.setPrototypeOf(this, SerializationError.prototype);
  }
}

export class DeadlockError extends DatabaseError {
  constructor(cause?: unknown) {
    super("Deadlock detected", "40P01", cause);
    this.name = "DeadlockError";
    Object.setPrototypeOf(this, DeadlockError.prototype);
  }
}

export class QueryTimeoutError extends DatabaseError {
  constructor(cause?: unknown) {
    super("Query timeout", "57014", cause);
    this.name = "QueryTimeoutError";
    Object.setPrototypeOf(this, QueryTimeoutError.prototype);
  }
}

export class ConnectionError extends DatabaseError {
  constructor(message: string, cause?: unknown) {
    super(message, "08xxx", cause);
    this.name = "ConnectionError";
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}
