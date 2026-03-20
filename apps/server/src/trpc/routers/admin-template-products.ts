import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@slushomat/db";
import {
  templateProduct,
  templateProductImage,
} from "@slushomat/db/schema";
import { env } from "@slushomat/env/server";
import {
  createSupabaseServiceClient,
  SupabaseStorageService,
} from "@slushomat/supabase";
import { router } from "../init";
import { adminProcedure } from "../procedures";

const taxRateSchema = z.union([z.literal(7), z.literal(19)]);

/** Matches admin UI: JPEG / PNG only, max 5 MiB. */
export const TEMPLATE_PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

function extForContentType(ct: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
  };
  return map[ct] ?? "jpg";
}

function getStorage(): SupabaseStorageService {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket =
    env.SUPABASE_STORAGE_BUCKET_TEMPLATE_PRODUCTS ?? "template-products";
  if (!url || !key) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (and optionally SUPABASE_STORAGE_BUCKET_TEMPLATE_PRODUCTS).",
    });
  }
  const client = createSupabaseServiceClient(url, key);
  return new SupabaseStorageService(client, bucket);
}

/** Path prefix inside the bucket: `template-products/{productId}/`. */
function pathPrefixForProduct(templateProductId: string): string {
  return `template-products/${templateProductId}/`;
}

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
  organizationId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const templateProductAdminRouter = router({
  list: adminProcedure.output(z.array(listItemSchema)).query(async ({ ctx }) => {
    let storage: SupabaseStorageService | null = null;
    try {
      storage = getStorage();
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
        imagePath: templateProductImage.objectPath,
        imageBucket: templateProductImage.bucket,
      })
      .from(templateProduct)
      .leftJoin(
        templateProductImage,
        eq(templateProduct.id, templateProductImage.templateProductId),
      )
      .where(isNull(templateProduct.organizationId))
      .orderBy(desc(templateProduct.createdAt));

    const out: z.infer<typeof listItemSchema>[] = [];
    for (const r of rows) {
      let imageUrl: string | null = null;
      if (
        storage &&
        r.imagePath &&
        r.imageBucket === storage.bucketName
      ) {
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
          organizationId: null,
        })
        .returning({
          id: templateProduct.id,
          name: templateProduct.name,
          priceInCents: templateProduct.priceInCents,
          taxRatePercent: templateProduct.taxRatePercent,
          organizationId: templateProduct.organizationId,
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
      await requireGlobalTemplate(ctx, input.id);
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
          organizationId: templateProduct.organizationId,
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
      await requireGlobalTemplate(ctx, input.id);
      const storage = getStorage();
      const [img] = await ctx.db
        .select({
          objectPath: templateProductImage.objectPath,
          bucket: templateProductImage.bucket,
        })
        .from(templateProductImage)
        .where(eq(templateProductImage.templateProductId, input.id))
        .limit(1);

      await ctx.db
        .delete(templateProduct)
        .where(eq(templateProduct.id, input.id));

      if (
        img?.objectPath &&
        img.bucket === storage.bucketName
      ) {
        try {
          await storage.removeObject(img.objectPath);
        } catch {
          /* best-effort */
        }
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
      await requireGlobalTemplate(ctx, input.templateProductId);
      const ct = input.contentType.toLowerCase().split(";")[0]!.trim();
      if (!ALLOWED_IMAGE_TYPES.has(ct)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only JPEG and PNG images are allowed.",
        });
      }
      const storage = getStorage();
      const safeExt = extForContentType(ct);
      const objectPath = `${pathPrefixForProduct(input.templateProductId)}${randomUUID()}.${safeExt}`;
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
      await requireGlobalTemplate(ctx, input.templateProductId);
      const storage = getStorage();
      const prefix = pathPrefixForProduct(input.templateProductId);
      if (
        !input.objectPath.startsWith(prefix) ||
        input.objectPath.includes("..")
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid object path",
        });
      }

      const [existing] = await ctx.db
        .select()
        .from(templateProductImage)
        .where(
          eq(templateProductImage.templateProductId, input.templateProductId),
        )
        .limit(1);

      if (
        existing &&
        existing.objectPath !== input.objectPath &&
        existing.bucket === storage.bucketName
      ) {
        try {
          await storage.removeObject(existing.objectPath);
        } catch {
          /* ignore */
        }
      }

      const bucket = storage.bucketName;
      const imageId = existing?.id ?? randomUUID();

      if (existing) {
        await ctx.db
          .update(templateProductImage)
          .set({ bucket, objectPath: input.objectPath })
          .where(eq(templateProductImage.templateProductId, input.templateProductId));
      } else {
        await ctx.db.insert(templateProductImage).values({
          id: imageId,
          templateProductId: input.templateProductId,
          bucket,
          objectPath: input.objectPath,
        });
      }

      return {
        id: imageId,
        templateProductId: input.templateProductId,
        bucket,
        objectPath: input.objectPath,
      };
    }),
});

async function requireGlobalTemplate(
  ctx: { db: typeof db },
  templateProductId: string,
) {
  const [row] = await ctx.db
    .select({ id: templateProduct.id })
    .from(templateProduct)
    .where(
      and(
        eq(templateProduct.id, templateProductId),
        isNull(templateProduct.organizationId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Template product not found",
    });
  }
}
