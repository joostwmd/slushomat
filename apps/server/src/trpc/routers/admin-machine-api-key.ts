import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { auth } from "@slushomat/auth";
import { apikey, machine } from "@slushomat/db/schema";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const secretOut = z.object({
  machineId: z.string(),
  apiKeyId: z.string(),
  key: z.string(),
  prefix: z.string().nullable().optional(),
  start: z.string().nullable().optional(),
});

const metaOut = z
  .object({
    id: z.string(),
    prefix: z.string().nullable().optional(),
    start: z.string().nullable().optional(),
    enabled: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .nullable();

function toDate(v: Date | string | null | undefined): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string") return new Date(v);
  return new Date();
}

type CreateApiKeyResult = {
  id: string;
  key: string;
  prefix?: string | null;
  start?: string | null;
};

export const machineApiKeyAdminRouter = router({
  getMetadata: adminProcedure
    .input(z.object({ machineId: z.string().min(1) }))
    .output(metaOut)
    .query(async ({ ctx, input }) => {
      const [m] = await ctx.db
        .select({ apiKeyId: machine.apiKeyId })
        .from(machine)
        .where(eq(machine.id, input.machineId))
        .limit(1);
      if (!m?.apiKeyId) return null;
      const [k] = await ctx.db
        .select()
        .from(apikey)
        .where(eq(apikey.id, m.apiKeyId))
        .limit(1);
      if (!k) return null;
      return {
        id: k.id,
        prefix: k.prefix,
        start: k.start,
        enabled: k.enabled !== false,
        createdAt: toDate(k.createdAt),
        updatedAt: toDate(k.updatedAt),
      };
    }),

  create: adminProcedure
    .input(z.object({ machineId: z.string().min(1) }))
    .output(secretOut)
    .mutation(async ({ ctx, input }) => {
      const [m] = await ctx.db
        .select()
        .from(machine)
        .where(eq(machine.id, input.machineId))
        .limit(1);
      if (!m) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Machine not found" });
      }
      if (m.apiKeyId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This machine already has an API key. Rotate instead.",
        });
      }

      let created: CreateApiKeyResult;
      try {
        created = (await auth.api.createApiKey({
          body: {
            name: `machine:${input.machineId}`,
            metadata: { machineId: input.machineId },
          },
          headers: ctx.headers,
        })) as CreateApiKeyResult;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to create API key";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
          cause: e,
        });
      }

      if (!created?.id || !created?.key) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invalid response from createApiKey",
        });
      }

      await ctx.db
        .update(machine)
        .set({ apiKeyId: created.id })
        .where(eq(machine.id, input.machineId));

      return {
        machineId: input.machineId,
        apiKeyId: created.id,
        key: created.key,
        prefix: created.prefix ?? null,
        start: created.start ?? null,
      };
    }),

  rotate: adminProcedure
    .input(z.object({ machineId: z.string().min(1) }))
    .output(secretOut)
    .mutation(async ({ ctx, input }) => {
      const [m] = await ctx.db
        .select()
        .from(machine)
        .where(eq(machine.id, input.machineId))
        .limit(1);
      if (!m) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Machine not found" });
      }
      if (!m.apiKeyId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No API key to rotate. Generate one first.",
        });
      }

      await ctx.db.delete(apikey).where(eq(apikey.id, m.apiKeyId));
      await ctx.db
        .update(machine)
        .set({ apiKeyId: null })
        .where(eq(machine.id, input.machineId));

      let created: CreateApiKeyResult;
      try {
        created = (await auth.api.createApiKey({
          body: {
            name: `machine:${input.machineId}`,
            metadata: { machineId: input.machineId },
          },
          headers: ctx.headers,
        })) as CreateApiKeyResult;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to rotate API key";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
          cause: e,
        });
      }

      if (!created?.id || !created?.key) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Invalid response from createApiKey",
        });
      }

      await ctx.db
        .update(machine)
        .set({ apiKeyId: created.id })
        .where(eq(machine.id, input.machineId));

      return {
        machineId: input.machineId,
        apiKeyId: created.id,
        key: created.key,
        prefix: created.prefix ?? null,
        start: created.start ?? null,
      };
    }),

  revoke: adminProcedure
    .input(z.object({ machineId: z.string().min(1) }))
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const [m] = await ctx.db
        .select()
        .from(machine)
        .where(eq(machine.id, input.machineId))
        .limit(1);
      if (!m) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Machine not found" });
      }
      if (m.apiKeyId) {
        await ctx.db.delete(apikey).where(eq(apikey.id, m.apiKeyId));
        await ctx.db
          .update(machine)
          .set({ apiKeyId: null })
          .where(eq(machine.id, input.machineId));
      }
      return { ok: true as const };
    }),
});
