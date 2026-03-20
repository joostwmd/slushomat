import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { UniqueViolationError } from "@slushomat/db";
import { dbSafe } from "@slushomat/db/safety-net";
import { machine, machineVersion } from "@slushomat/db/schema";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const versionRow = z.object({
  id: z.string(),
  versionNumber: z.string(),
  description: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const machineRow = z.object({
  id: z.string(),
  machineVersionId: z.string(),
  versionNumber: z.string(),
  comments: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const machineVersionAdminRouter = router({
  list: adminProcedure.output(z.array(versionRow)).query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: machineVersion.id,
        versionNumber: machineVersion.versionNumber,
        description: machineVersion.description,
        createdAt: machineVersion.createdAt,
        updatedAt: machineVersion.updatedAt,
      })
      .from(machineVersion)
      .orderBy(desc(machineVersion.createdAt));
  }),

  create: adminProcedure
    .input(
      z.object({
        versionNumber: z.string().min(1, "Version number is required"),
        description: z.string().min(1, "Description is required"),
      }),
    )
    .output(versionRow)
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      const versionNumber = input.versionNumber.trim();
      const description = input.description.trim();
      try {
        const [row] = await dbSafe(() =>
          ctx.db
            .insert(machineVersion)
            .values({ id, versionNumber, description })
            .returning({
              id: machineVersion.id,
              versionNumber: machineVersion.versionNumber,
              description: machineVersion.description,
              createdAt: machineVersion.createdAt,
              updatedAt: machineVersion.updatedAt,
            }),
        );
        if (!row) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create machine version",
          });
        }
        return row;
      } catch (err) {
        if (err instanceof UniqueViolationError) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Version number already exists",
            cause: err,
          });
        }
        throw err;
      }
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        description: z.string().min(1, "Description is required"),
      }),
    )
    .output(versionRow)
    .mutation(async ({ ctx, input }) => {
      const description = input.description.trim();
      const [row] = await ctx.db
        .update(machineVersion)
        .set({ description })
        .where(eq(machineVersion.id, input.id))
        .returning({
          id: machineVersion.id,
          versionNumber: machineVersion.versionNumber,
          description: machineVersion.description,
          createdAt: machineVersion.createdAt,
          updatedAt: machineVersion.updatedAt,
        });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine version not found",
        });
      }
      return row;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const inUse = await ctx.db
        .select({ id: machine.id })
        .from(machine)
        .where(eq(machine.machineVersionId, input.id))
        .limit(1);
      if (inUse.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This version is still assigned to one or more machines. Reassign or remove those machines first.",
        });
      }
      const deleted = await ctx.db
        .delete(machineVersion)
        .where(eq(machineVersion.id, input.id))
        .returning({ id: machineVersion.id });
      if (deleted.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine version not found",
        });
      }
      return { ok: true as const };
    }),
});

export const machineAdminRouter = router({
  list: adminProcedure.output(z.array(machineRow)).query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: machine.id,
        machineVersionId: machine.machineVersionId,
        versionNumber: machineVersion.versionNumber,
        comments: machine.comments,
        createdAt: machine.createdAt,
        updatedAt: machine.updatedAt,
      })
      .from(machine)
      .innerJoin(
        machineVersion,
        eq(machine.machineVersionId, machineVersion.id),
      )
      .orderBy(desc(machine.createdAt));
  }),

  create: adminProcedure
    .input(
      z.object({
        machineVersionId: z.string().min(1, "Version is required"),
        comments: z.string(),
      }),
    )
    .output(machineRow)
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      const comments = input.comments.trim();
      const [inserted] = await dbSafe(() =>
        ctx.db
          .insert(machine)
          .values({
            id,
            machineVersionId: input.machineVersionId,
            comments,
          })
          .returning({ id: machine.id }),
      );
      if (!inserted) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create machine",
        });
      }
      const [withVersion] = await ctx.db
        .select({
          id: machine.id,
          machineVersionId: machine.machineVersionId,
          versionNumber: machineVersion.versionNumber,
          comments: machine.comments,
          createdAt: machine.createdAt,
          updatedAt: machine.updatedAt,
        })
        .from(machine)
        .innerJoin(
          machineVersion,
          eq(machine.machineVersionId, machineVersion.id),
        )
        .where(eq(machine.id, id))
        .limit(1);
      if (!withVersion) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load created machine",
        });
      }
      return withVersion;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        machineVersionId: z.string().min(1, "Version is required"),
        comments: z.string(),
      }),
    )
    .output(machineRow)
    .mutation(async ({ ctx, input }) => {
      const comments = input.comments.trim();
      const [updated] = await dbSafe(() =>
        ctx.db
          .update(machine)
          .set({
            machineVersionId: input.machineVersionId,
            comments,
          })
          .where(eq(machine.id, input.id))
          .returning({ id: machine.id }),
      );
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine not found",
        });
      }
      const [row] = await ctx.db
        .select({
          id: machine.id,
          machineVersionId: machine.machineVersionId,
          versionNumber: machineVersion.versionNumber,
          comments: machine.comments,
          createdAt: machine.createdAt,
          updatedAt: machine.updatedAt,
        })
        .from(machine)
        .innerJoin(
          machineVersion,
          eq(machine.machineVersionId, machineVersion.id),
        )
        .where(eq(machine.id, input.id))
        .limit(1);
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load updated machine",
        });
      }
      return row;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(machine)
        .where(eq(machine.id, input.id))
        .returning({ id: machine.id });
      if (deleted.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Machine not found",
        });
      }
      return { ok: true as const };
    }),
});
