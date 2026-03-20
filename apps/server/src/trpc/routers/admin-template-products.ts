import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import { productImage, templateProduct } from "@slushomat/db/schema";
import {
  deleteProductImageIfUnreferenced,
  extForContentType,
  getProductImageStorage,
  pathPrefixTemplateProduct,
  TEMPLATE_PRODUCT_IMAGE_MAX_BYTES,
  ALLOWED_PRODUCT_IMAGE_TYPES,
} from "../../lib/product-image";
import { router } from "../init";
import { adminProcedure } from "../procedures";

export { TEMPLATE_PRODUCT_IMAGE_MAX_BYTES } from "../../lib/product-image";

const taxRateSchema = z.union([z.literal(7), z.literal(19)]);

const listItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceInCents: z.number().int(),
  taxRatePercent: taxRateSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  imageUrl: z.string().nullable(),
});

const templateProductRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceInCents: z.number().int(),
  taxRatePercent: taxRateSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const templateProductAdminRouter = router({
  list: adminProcedure.output(z.array(listItemSchema)).query(async ({ ctx }) => {
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

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        priceInCents: z.number().int().nonnegative(),
        taxRatePercent: taxRateSchema,
      }),
    )
    .output(templateProductRowSchema)
    .mutation(async ({ ctx, input }) => {
      const id = randomUUID();
      const name = input.name.trim();
      const [row] = await ctx.db
        .insert(templateProduct)
        .values({
          id,
          name,
          priceInCents: input.priceInCents,
          taxRatePercent: input.taxRatePercent,
        })
        .returning({
          id: templateProduct.id,
          name: templateProduct.name,
          priceInCents: templateProduct.priceInCents,
          taxRatePercent: templateProduct.taxRatePercent,
          createdAt: templateProduct.createdAt,
          updatedAt: templateProduct.updatedAt,
        });
      if (!row) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create template product",
        });
      }
      return {
        ...row,
        taxRatePercent: row.taxRatePercent as 7 | 19,
      };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1, "Name is required"),
        priceInCents: z.number().int().nonnegative(),
        taxRatePercent: taxRateSchema,
      }),
    )
    .output(templateProductRowSchema)
    .mutation(async ({ ctx, input }) => {
      await requireTemplateProduct(ctx, input.id);
      const name = input.name.trim();
      const [row] = await ctx.db
        .update(templateProduct)
        .set({
          name,
          priceInCents: input.priceInCents,
          taxRatePercent: input.taxRatePercent,
        })
        .where(eq(templateProduct.id, input.id))
        .returning({
          id: templateProduct.id,
          name: templateProduct.name,
          priceInCents: templateProduct.priceInCents,
          taxRatePercent: templateProduct.taxRatePercent,
          createdAt: templateProduct.createdAt,
          updatedAt: templateProduct.updatedAt,
        });
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Template product not found",
        });
      }
      return {
        ...row,
        taxRatePercent: row.taxRatePercent as 7 | 19,
      };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      await requireTemplateProduct(ctx, input.id);
      const storage = getProductImageStorage();
      const [prev] = await ctx.db
        .select({ productImageId: templateProduct.productImageId })
        .from(templateProduct)
        .where(eq(templateProduct.id, input.id))
        .limit(1);

      await ctx.db
        .delete(templateProduct)
        .where(eq(templateProduct.id, input.id));

      if (prev?.productImageId) {
        await deleteProductImageIfUnreferenced(
          ctx.db,
          storage,
          prev.productImageId,
        );
      }
      return { ok: true as const };
    }),

  requestImageUpload: adminProcedure
    .input(
      z.object({
        templateProductId: z.string().min(1),
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
      await requireTemplateProduct(ctx, input.templateProductId);
      const ct = input.contentType.toLowerCase().split(";")[0]!.trim();
      if (!ALLOWED_PRODUCT_IMAGE_TYPES.has(ct)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only JPEG and PNG images are allowed.",
        });
      }
      const storage = getProductImageStorage();
      const safeExt = extForContentType(ct);
      const objectPath = `${pathPrefixTemplateProduct(input.templateProductId)}${randomUUID()}.${safeExt}`;
      const { path, token, signedUrl } =
        await storage.createSignedUploadUrl(objectPath, { upsert: true });
      return {
        bucket: storage.bucketName,
        path,
        token,
        signedUrl,
      };
    }),

  confirmTemplateProductImage: adminProcedure
    .input(
      z.object({
        templateProductId: z.string().min(1),
        objectPath: z.string().min(1),
      }),
    )
    .output(
      z.object({
        id: z.string(),
        templateProductId: z.string(),
        bucket: z.string(),
        objectPath: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireTemplateProduct(ctx, input.templateProductId);
      const storage = getProductImageStorage();
      const prefix = pathPrefixTemplateProduct(input.templateProductId);
      if (
        !input.objectPath.startsWith(prefix) ||
        input.objectPath.includes("..")
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid object path",
        });
      }

      const [tpl] = await ctx.db
        .select({ productImageId: templateProduct.productImageId })
        .from(templateProduct)
        .where(eq(templateProduct.id, input.templateProductId))
        .limit(1);

      if (tpl?.productImageId) {
        const [currentImg] = await ctx.db
          .select()
          .from(productImage)
          .where(eq(productImage.id, tpl.productImageId))
          .limit(1);
        if (
          currentImg &&
          currentImg.objectPath === input.objectPath &&
          currentImg.bucket === storage.bucketName
        ) {
          return {
            id: currentImg.id,
            templateProductId: input.templateProductId,
            bucket: currentImg.bucket,
            objectPath: currentImg.objectPath,
          };
        }
      }

      const previousImageId = tpl?.productImageId ?? null;
      const newImageId = randomUUID();
      const bucket = storage.bucketName;

      await ctx.db.insert(productImage).values({
        id: newImageId,
        bucket,
        objectPath: input.objectPath,
      });

      await ctx.db
        .update(templateProduct)
        .set({ productImageId: newImageId })
        .where(eq(templateProduct.id, input.templateProductId));

      if (previousImageId) {
        await deleteProductImageIfUnreferenced(
          ctx.db,
          storage,
          previousImageId,
        );
      }

      return {
        id: newImageId,
        templateProductId: input.templateProductId,
        bucket,
        objectPath: input.objectPath,
      };
    }),
});

async function requireTemplateProduct(
  ctx: { db: typeof db },
  templateProductId: string,
) {
  const [row] = await ctx.db
    .select({ id: templateProduct.id })
    .from(templateProduct)
    .where(eq(templateProduct.id, templateProductId))
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Template product not found",
    });
  }
}
