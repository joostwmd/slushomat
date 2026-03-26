import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { tx } from "../transaction";
import type { Transact } from "../transaction";
import type { StaticEntityScope } from "./define-static-entity";
import type { Session } from "./types";

/**
 * Runtime CRUD for `defineStaticEntity` tables (org / user scoped).
 * Uses the global `tx` proxy — `transact` must wrap calls in `withTransaction`.
 */
export abstract class StaticTable {
  constructor(
    protected readonly transact: Transact,
    protected readonly session: Session,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract readonly table: any;
  protected abstract readonly config: {
    scope: StaticEntityScope;
    softDelete: boolean;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cols(): any {
    return this.table;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async get(id: string): Promise<any | undefined> {
    return this.transact(async () => {
      const rows = await tx
        .select()
        .from(this.table)
        .where(eq(this.cols().id, id))
        .limit(1);
      return rows[0];
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getOrThrow(id: string): Promise<any> {
    const row = await this.get(id);
    if (!row) throw new Error(`StaticTable: row not found (${id})`);
    return row;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getAll(): Promise<any[]> {
    return this.transact(async () => {
      const conditions = [];
      const c = this.cols();
      if (
        this.config.scope === "org" ||
        this.config.scope === "org-user"
      ) {
        if (c.operatorId) {
          conditions.push(
            eq(c.operatorId, this.session.operatorId),
          );
        }
      }
      if (this.config.softDelete && c.deletedAt) {
        conditions.push(isNull(c.deletedAt));
      }
      const where =
        conditions.length === 0
          ? undefined
          : conditions.length === 1
            ? conditions[0]
            : and(...conditions);

      const q = tx.select().from(this.table);
      const rows = where ? await q.where(where) : await q;
      return rows;
    });
  }

  async create(
    data: Record<string, unknown> & { id?: string },
  ): Promise<string> {
    return this.transact(async () => {
      const id = data.id ?? randomUUID();
      const { id: _drop, ...rest } = data;
      void _drop;
      const values: Record<string, unknown> = {
        ...rest,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      if (this.config.scope === "org" || this.config.scope === "org-user") {
        values.operatorId = this.session.operatorId;
      }
      if (this.config.scope === "user" || this.config.scope === "org-user") {
        values.userId = this.session.user.id;
      }
      await tx.insert(this.table).values(values);
      return id;
    });
  }

  async update(id: string, data: Record<string, unknown>): Promise<void> {
    return this.transact(async () => {
      await tx
        .update(this.table)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(this.cols().id, id));
    });
  }

  async delete(id: string): Promise<void> {
    return this.transact(async () => {
      if (this.config.softDelete && this.cols().deletedAt) {
        await tx
          .update(this.table)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(this.cols().id, id));
      } else {
        await tx.delete(this.table).where(eq(this.cols().id, id));
      }
    });
  }
}
