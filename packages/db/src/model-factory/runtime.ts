/**
 * Runtime repositories — import from `@slushomat/db/model-factory/runtime`.
 * Kept separate from `model-factory` barrel so schema modules avoid importing
 * `transaction` → `connection` → `schema` (circular init).
 */
export { StaticTable } from "./static-table";
export { VersionedTable } from "./versioned-table";
export type { Transact } from "../transaction";
export { runInTransaction } from "../transaction";
