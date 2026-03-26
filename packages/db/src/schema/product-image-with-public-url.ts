import { sql } from "drizzle-orm";
import { pgView } from "drizzle-orm/pg-core";

import { productImage } from "./product-image";

/**
 * Public Storage path for each `product_image` row (Supabase public bucket).
 *
 * `image_url` is the path after the project origin, e.g.
 * `/storage/v1/object/public/{bucket}/{object_path}`. Resolve the full HTTPS URL
 * with `new URL(row.imageUrl, SUPABASE_URL)` (see server helper).
 *
 * Apply to the database with **`pnpm db:push`** from `packages/db` (not versioned
 * migrations — same pattern as analytics MV + audit DDL in `0000`).
 */
export const productImageWithPublicUrl = pgView("product_image_with_public_url").as(
  (qb) =>
    qb
      .select({
        id: productImage.id,
        bucket: productImage.bucket,
        objectPath: productImage.objectPath,
        createdAt: productImage.createdAt,
        updatedAt: productImage.updatedAt,
        imageUrl: sql<string | null>`CASE WHEN ${productImage.bucket} IS NOT NULL AND ${productImage.objectPath} IS NOT NULL THEN '/storage/v1/object/public/' || ${productImage.bucket} || '/' || ${productImage.objectPath} ELSE NULL END`.as(
          "image_url",
        ),
      })
      .from(productImage),
);
