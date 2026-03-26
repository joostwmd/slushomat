import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "@slushomat/db";
import {
  operatorProduct,
  productImage,
  templateProduct,
} from "@slushomat/db/schema";
import { env } from "@slushomat/env/server";
import {
  createSupabaseServiceClient,
  SupabaseStorageService,
} from "@slushomat/supabase";

export type DbClient = typeof db;

/** Matches admin / operator UI: JPEG / PNG only, max 5 MiB. */
export const TEMPLATE_PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const ALLOWED_PRODUCT_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);

export function extForContentType(ct: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
  };
  return map[ct] ?? "jpg";
}

/** Path prefix inside the bucket: `template-products/{templateProductId}/`. */
export function pathPrefixTemplateProduct(templateProductId: string): string {
  return `template-products/${templateProductId}/`;
}

/** Path prefix inside the bucket: `operator-products/{operatorProductId}/`. */
export function pathPrefixOperatorProduct(operatorProductId: string): string {
  return `operator-products/${operatorProductId}/`;
}

/**
 * Single bucket for template and operator product images; `product_image.bucket` must match
 * before calling `removeObject`.
 */
/**
 * Turn `product_image_with_public_url.image_url` (path starting with `/storage/v1/object/public/...`)
 * into a full HTTPS URL using the configured Supabase project URL.
 */
export function resolvePublicStorageImageUrl(
  supabaseProjectUrl: string | undefined,
  imagePathFromView: string | null | undefined,
): string | null {
  if (!supabaseProjectUrl?.trim() || !imagePathFromView) {
    return null;
  }
  const base = supabaseProjectUrl.replace(/\/$/, "");
  try {
    return new URL(imagePathFromView, `${base}/`).href;
  } catch {
    return null;
  }
}

export function getProductImageStorage(): SupabaseStorageService {
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

/**
 * If nothing references `product_image.id`, removes the Storage object (when bucket matches)
 * and deletes the row. Safe to call after clearing FKs or deleting a product row.
 */
export async function deleteProductImageIfUnreferenced(
  dbClient: DbClient,
  storage: SupabaseStorageService,
  productImageId: string,
): Promise<void> {
  const [tplRef] = await dbClient
    .select({ id: templateProduct.id })
    .from(templateProduct)
    .where(eq(templateProduct.productImageId, productImageId))
    .limit(1);
  const [opRef] = await dbClient
    .select({ id: operatorProduct.id })
    .from(operatorProduct)
    .where(eq(operatorProduct.productImageId, productImageId))
    .limit(1);
  if (tplRef || opRef) {
    return;
  }

  const [img] = await dbClient
    .select()
    .from(productImage)
    .where(eq(productImage.id, productImageId))
    .limit(1);
  if (!img) {
    return;
  }

  if (img.bucket === storage.bucketName && img.objectPath) {
    try {
      await storage.removeObject(img.objectPath);
    } catch {
      /* best-effort */
    }
  }
  await dbClient.delete(productImage).where(eq(productImage.id, productImageId));
}
