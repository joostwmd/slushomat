import type { Transact } from "../transaction";
import type { Session } from "./types";

/**
 * Runtime base for `defineVersionedEntity` tables.
 * Extend in app services when implementing contract versioning (T03+).
 */
export abstract class VersionedTable<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _TBase extends any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _TVersions extends any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _TChanges extends any,
> {
  constructor(
    protected readonly transact: Transact,
    protected readonly session: Session,
  ) {}
}
