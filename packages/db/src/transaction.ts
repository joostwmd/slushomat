import { AsyncLocalStorage } from "node:async_hooks";

import { db } from "./connection";
import { dbSafe } from "./safety-net";

type DrizzleTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

const transactionStorage = new AsyncLocalStorage<DrizzleTransaction>();

export const tx = new Proxy({} as DrizzleTransaction, {
  get(_target, prop, receiver) {
    const currentTx = transactionStorage.getStore();
    const instance =
      currentTx ?? (db as unknown as DrizzleTransaction);
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === "function") return value.bind(instance);
    return value;
  },
});

export async function withTransaction<T>(
  callback: () => Promise<T>,
  config?: {
    isolationLevel?:
      | "read uncommitted"
      | "read committed"
      | "repeatable read"
      | "serializable";
    accessMode?: "read only" | "read write";
  },
): Promise<T> {
  const existingTx = transactionStorage.getStore();
  if (existingTx) return callback();
  return dbSafe(() =>
    db.transaction(async (transaction) => {
      return transactionStorage.run(transaction, callback);
    }, config),
  );
}
