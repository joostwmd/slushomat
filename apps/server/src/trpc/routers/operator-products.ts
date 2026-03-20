import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import {
  operatorProduct,
  productImage,
  templateProduct,
} from "@slushomat/db/schema";
import {
  assertUserMemberOfOrg,
  getOrganizationIdForSlug,
} from "../../lib/org-scope";
import {
  ALLOWED_PRODUCT_IMAGE_TYPES,
  deleteProductImageIfUnreferenced,
  extForContentType,
  getProductImageStorage,
  pathPrefixOperatorProduct,
  TEMPLATE_PRODUCT_IMAGE_MAX_BYTES,
} from "../../lib/product-image";
import { router } from "../init";
import { operatorProcedure } from "../procedures";

const taxRateSchema = z.union([z.literal(7), z.literal(19)]);

const orgSlugInput = z.object({
  orgSlug: z.string().min(1),
});

const listItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceInCents: z.number().int(),
  taxRatePercent: taxRateSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  imageUrl: z.string().nullable(),
});

const operatorProductRowSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  priceInCents: z.number().int(),
  taxRatePercent: taxRateSchema,
  productImageId: z.string().nullable(),
  sourceTemplateProductId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

async function resolveOrgWithMembership(
  ctx: { db: typeof db; user: { id: string } },
  orgSlug: string,
): Promise<string> {
  const organizationId = await getOrganizationIdForSlug(ctx.db, orgSlug);
  await assertUserMemberOfOrg(ctx.db, ctx.user.id, organizationId);
  return organizationId;
}

async function requireOperatorProductInOrg(
  dbClient: typeof db,
  organizationId: string,
  operatorProductId: string,
) {
  const [row] = await dbClient
    .select()
    .from(operatorProduct)
    .where(
      and(
        eq(operatorProduct.id, operatorProductId),
        eq(operatorProduct.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Product not found",
    });
  }
  return row;
}

export const operatorProductRouter = router({
  list: operatorProcedure
    .input(orgSlugInput)
    .output(z.array(listItemSchema))
    .query(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(ctx, input.orgSlug);

      let storage: ReturnType<typeof getProductImageStorage> | null = null;
      try {
        storage = getProductImageStorage();
      } catch {
        storage = null;
      }

      const rows = await ctx.db
        .select({
          id: operatorProduct.id,
          name: operatorProduct.name,
          priceInCents: operatorProduct.priceInCents,
          taxRatePercent: operatorProduct.taxRatePercent,
          createdAt: operatorProduct.createdAt,
          updatedAt: operatorProduct.updatedAt,
          imagePath: productImage.objectPath,
          imageBucket: productImage.bucket,
        })
        .from(operatorProduct)
        .leftJoin(
          productImage,
          eq(operatorProduct.productImageId, productImage.id),
        )
        .where(eq(operatorProduct.organizationId, organizationId))
        .orderBy(desc(operatorProduct.createdAt));

      const out: z.infer<typeof listItemSchema>[] = [];
      for (const r of rows) {
        let imageUrl: string | null = null;
        if (storage && r.imagePath && r.imageBucket === storage.bucketName) {
          try {
            imageUrl = await storage.createSignedDownloadUrl(r.imagePath, 3600);
          } catch {
            imageUrl = null;
          }
        }
        out.push({
          id: r.id,
          name: r.name,
          priceInCents: r.priceInCents,
          taxRatePercent: r.taxRatePercent as 7 | 19,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          imageUrl,
        });
      }
      return out;
    }),

  create: operatorProcedure
    .input(
      orgSlugInput.extend({
        name: z.string().min(1, "Name is required"),
        priceInCents: z.number().int().nonnegative(),
        taxRatePercent: taxRateSchema,
      }),
    )
    .output(operatorProductRowSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(ctx, input.orgSlug);
      const id = randomUUID();
      const name = input.name.trim();
      const [row] = await ctx.db
        .insert(operatorProduct)
        .values({
          id,
          organizationId,
          name,
          priceInCents: input.priceInCents,
          taxRatePercent: input.taxRatePercent,
        })
        .returning({
          id: operatorProduct.id,
          organizationId: operatorProduct.organizationId,
          name: operatorProduct.name,
          priceInCents: operatorProduct.priceInCents,
          taxRatePercent: operatorProduct.taxRatePercent,
          productImageId: operatorProduct.productImageId,
          sourceTemplateProductId: operatorProduct.sourceTemplateProductId,
          createdAt: operatorProduct.createdAt,
          updatedAt: operatorProduct.updatedAt,
        });
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create product",
        });
      }
      return {
        ...row,
        taxRatePercent: row.taxRatePercent as 7 | 19,
      };
    }),

  update: operatorProcedure
    .input(
      orgSlugInput.extend({
        id: z.string().min(1),
        name: z.string().min(1, "Name is required"),
        priceInCents: z.number().int().nonnegative(),
        taxRatePercent: taxRateSchema,
      }),
    )
    .output(operatorProductRowSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(ctx, input.orgSlug);
      await requireOperatorProductInOrg(ctx.db, organizationId, input.id);
      const name = input.name.trim();
      const [row] = await ctx.db
        .update(operatorProduct)
        .set({
          name,
          priceInCents: input.priceInCents,
          taxRatePercent: input.taxRatePercent,
        })
        .where(eq(operatorProduct.id, input.id))
        .returning({
          id: operatorProduct.id,
          organizationId: operatorProduct.organizationId,
          name: operatorProduct.name,
          priceInCents: operatorProduct.priceInCents,
          taxRatePercent: operatorProduct.taxRatePercent,
          productImageId: operatorProduct.productImageId,
          sourceTemplateProductId: operatorProduct.sourceTemplateProductId,
          createdAt: operatorProduct.createdAt,
          updatedAt: operatorProduct.updatedAt,
        });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found",
        });
      }
      return {
        ...row,
        taxRatePercent: row.taxRatePercent as 7 | 19,
      };
    }),

  delete: operatorProcedure
    .input(orgSlugInput.extend({ id: z.string().min(1) }))
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(ctx, input.orgSlug);
      const storage = getProductImageStorage();
      const [prev] = await ctx.db
        .select({ productImageId: operatorProduct.productImageId })
        .from(operatorProduct)
        .where(
          and(
            eq(operatorProduct.id, input.id),
            eq(operatorProduct.organizationId, organizationId),
          ),
        )
        .limit(1);
      if (!prev) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found",
        });
      }

      await ctx.db.delete(operatorProduct).where(eq(operatorProduct.id, input.id));

      if (prev.productImageId) {
        await deleteProductImageIfUnreferenced(
          ctx.db,
          storage,
          prev.productImageId,
        );
      }
      return { ok: true as const };
    }),

  copyFromTemplate: operatorProcedure
    .input(orgSlugInput.extend({ templateProductId: z.string().min(1) }))
    .output(operatorProductRowSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(ctx, input.orgSlug);
      const [tpl] = await ctx.db
        .select()
        .from(templateProduct)
        .where(eq(templateProduct.id, input.templateProductId))
        .limit(1);
      if (!tpl) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template product not found",
        });
      }

      const id = randomUUID();
      const [row] = await ctx.db
        .insert(operatorProduct)
        .values({
          id,
          organizationId,
          name: tpl.name,
          priceInCents: tpl.priceInCents,
          taxRatePercent: tpl.taxRatePercent,
          productImageId: tpl.productImageId,
          sourceTemplateProductId: tpl.id,
        })
        .returning({
          id: operatorProduct.id,
          organizationId: operatorProduct.organizationId,
          name: operatorProduct.name,
          priceInCents: operatorProduct.priceInCents,
          taxRatePercent: operatorProduct.taxRatePercent,
          productImageId: operatorProduct.productImageId,
          sourceTemplateProductId: operatorProduct.sourceTemplateProductId,
          createdAt: operatorProduct.createdAt,
          updatedAt: operatorProduct.updatedAt,
        });
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to copy product",
        });
      }
      return {
        ...row,
        taxRatePercent: row.taxRatePercent as 7 | 19,
      };
    }),

  listTemplates: operatorProcedure
    .input(orgSlugInput)
    .output(z.array(listItemSchema))
    .query(async ({ ctx, input }) => {
      await resolveOrgWithMembership(ctx, input.orgSlug);

      let storage: ReturnType<typeof getProductImageStorage> | null = null;
      try {
        storage = getProductImageStorage();
      } catch {
        storage = null;
      }

      const rows = await ctx.db
        .select({
          id: templateProduct.id,
          name: templateProduct.name,
          priceInCents: templateProduct.priceInCents,
          taxRatePercent: templateProduct.taxRatePercent,
          createdAt: templateProduct.createdAt,
          updatedAt: templateProduct.updatedAt,
          imagePath: productImage.objectPath,
          imageBucket: productImage.bucket,
        })
        .from(templateProduct)
        .leftJoin(
          productImage,
          eq(templateProduct.productImageId, productImage.id),
        )
        .orderBy(desc(templateProduct.createdAt));

      const out: z.infer<typeof listItemSchema>[] = [];
      for (const r of rows) {
        let imageUrl: string | null = null;
        if (storage && r.imagePath && r.imageBucket === storage.bucketName) {
          try {
            imageUrl = await storage.createSignedDownloadUrl(r.imagePath, 3600);
          } catch {
            imageUrl = null;
          }
        }
        out.push({
          id: r.id,
          name: r.name,
          priceInCents: r.priceInCents,
          taxRatePercent: r.taxRatePercent as 7 | 19,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          imageUrl,
        });
      }
      return out;
    }),

  requestImageUpload: operatorProcedure
    .input(
      orgSlugInput.extend({
        operatorProductId: z.string().min(1),
        contentType: z.string().min(1),
        filename: z.string().optional(),
        fileSizeBytes: z
          .number()
          .int()
          .positive()
          .max(TEMPLATE_PRODUCT_IMAGE_MAX_BYTES),
      }),
    )
    .output(
      z.object({
        bucket: z.string(),
        path: z.string(),
        token: z.string(),
        signedUrl: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(ctx, input.orgSlug);
      await requireOperatorProductInOrg(
        ctx.db,
        organizationId,
        input.operatorProductId,
      );

      const ct = input.contentType.toLowerCase().split(";")[0]!.trim();
      if (!ALLOWED_PRODUCT_IMAGE_TYPES.has(ct)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only JPEG and PNG images are allowed.",
        });
      }
      const storage = getProductImageStorage();
      const safeExt = extForContentType(ct);
      const objectPath = `${pathPrefixOperatorProduct(input.operatorProductId)}${randomUUID()}.${safeExt}`;
      const { path, token, signedUrl } =
        await storage.createSignedUploadUrl(objectPath, { upsert: true });
      return {
        bucket: storage.bucketName,
        path,
        token,
        signedUrl,
      };
    }),

  confirmProductImage: operatorProcedure
    .input(
      orgSlugInput.extend({
        operatorProductId: z.string().min(1),
        objectPath: z.string().min(1),
      }),
    )
    .output(
      z.object({
        id: z.string(),
        operatorProductId: z.string(),
        bucket: z.string(),
        objectPath: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = await resolveOrgWithMembership(ctx, input.orgSlug);
      await requireOperatorProductInOrg(
        ctx.db,
        organizationId,
        input.operatorProductId,
      );

      const storage = getProductImageStorage();
      const prefix = pathPrefixOperatorProduct(input.operatorProductId);
      if (
        !input.objectPath.startsWith(prefix) ||
        input.objectPath.includes("..")
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid object path",
        });
      }

      const [row] = await ctx.db
        .select({ productImageId: operatorProduct.productImageId })
        .from(operatorProduct)
        .where(eq(operatorProduct.id, input.operatorProductId))
        .limit(1);

      if (row?.productImageId) {
        const [currentImg] = await ctx.db
          .select()
          .from(productImage)
          .where(eq(productImage.id, row.productImageId))
          .limit(1);
        if (
          currentImg &&
          currentImg.objectPath === input.objectPath &&
          currentImg.bucket === storage.bucketName
        ) {
          return {
            id: currentImg.id,
            operatorProductId: input.operatorProductId,
            bucket: currentImg.bucket,
            objectPath: currentImg.objectPath,
          };
        }
      }

      const previousImageId = row?.productImageId ?? null;
      const newImageId = randomUUID();
      const bucket = storage.bucketName;

      await ctx.db.insert(productImage).values({
        id: newImageId,
        bucket,
        objectPath: input.objectPath,
      });

      await ctx.db
        .update(operatorProduct)
        .set({ productImageId: newImageId })
        .where(eq(operatorProduct.id, input.operatorProductId));

      if (previousImageId) {
        await deleteProductImageIfUnreferenced(
          ctx.db,
          storage,
          previousImageId,
        );
      }

      return {
        id: newImageId,
        operatorProductId: input.operatorProductId,
        bucket,
        objectPath: input.objectPath,
      };
    }),
});
