/**
 * Production-like load seed for Slushomat.
 *
 * Env:
 *   DATABASE_URL           — Postgres (dedicated staging/load project recommended)
 *   SEED_PROFILE           — smoke | medium | heavy (default: smoke)
 *   SEED_RANDOM            — uint32 seed for deterministic RNG (default: 42)
 *   SEED_SKIP_STORAGE      — if "1", skip Supabase uploads (document/product_image rows still written; downloads will fail)
 *   SUPABASE_URL           — required unless SEED_SKIP_STORAGE=1
 *   SUPABASE_SERVICE_ROLE_KEY — required unless SEED_SKIP_STORAGE=1
 *   SUPABASE_STORAGE_BUCKET_TEMPLATE_PRODUCTS — optional, default template-products
 *
 * Loads .env from repo root and apps/server/.env (first wins for duplicate keys).
 *
 * Run: pnpm --filter @slushomat/db db:seed
 */
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import type { InferInsertModel } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { Pool } from "pg";

import { createSupabaseServiceClient } from "@slushomat/supabase";
import * as schema from "../src/schema";

import {
  CONTRACT_VERSION_DIST,
  ENTITY_COUNT_DIST,
  MACHINE_COUNT_DIST,
  resolveProfile,
} from "./seed-config";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });
config({ path: resolve(__dirname, "../../../apps/server/.env") });

const {
  organization,
  businessEntity,
  machine,
  machineVersion,
  operatorProduct,
  productImage,
  operatorMachine,
  machineSlot,
  operatorContract,
  operatorContractVersion,
  purchase,
  document,
} = schema;

const CONTRACT_VERSION_ENTITY_TYPE = "operator_contract_version" as const;

/** 1×1 JPEG — valid for Storage / UI checks */
const MINIMAL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=",
  "base64",
);

function minimalPdfBuffer(): Buffer {
  const fixture = resolve(__dirname, "fixtures/sample-contract.pdf");
  if (existsSync(fixture)) {
    return readFileSync(fixture);
  }
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
    "utf8",
  );
}

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T extends number>(
  rng: () => number,
  dist: readonly { count: T; p: number }[],
): T {
  const r = rng();
  let c = 0;
  for (const row of dist) {
    c += row.p;
    if (r < c) {
      return row.count;
    }
  }
  return dist[dist.length - 1]!.count;
}

function randomIntInclusive(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function randomDateInRange(rng: () => number, start: Date, end: Date): Date {
  const t0 = start.getTime();
  const t1 = end.getTime();
  return new Date(t0 + Math.floor(rng() * (t1 - t0 + 1)));
}

const SLOT_SIDES = ["left", "middle", "right"] as const;

function slotFillCount(rng: () => number): number {
  const r = rng();
  if (r < 0.92) {
    return 3;
  }
  if (r < 0.98) {
    return 2;
  }
  return 1;
}

function assignSlots(
  rng: () => number,
  filledCount: number,
  productIds: string[],
): { slot: (typeof SLOT_SIDES)[number]; operatorProductId: string | null }[] {
  const order = shuffle([...SLOT_SIDES], rng);
  const filled = new Set(order.slice(0, filledCount));
  return SLOT_SIDES.map((slot) => ({
    slot,
    operatorProductId: filled.has(slot)
      ? productIds[Math.floor(rng() * productIds.length)]!
      : null,
  }));
}

function splitIntegerAcrossBins(
  total: number,
  bins: number,
  rng: () => number,
): number[] {
  if (bins <= 0) {
    return [];
  }
  const weights = Array.from({ length: bins }, () => rng());
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const parts = weights.map((w) => Math.floor((w / sum) * total));
  let diff = total - parts.reduce((a, b) => a + b, 0);
  let i = 0;
  while (diff > 0) {
    parts[i % bins]!++;
    diff--;
    i++;
  }
  return parts;
}

type SlotSale = {
  slotId: string;
  operatorProductId: string;
  purchaseCount: number;
};

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const idx = cursor++;
      if (idx >= items.length) {
        return;
      }
      await fn(items[idx]!, idx);
    }
  }
  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.trim()) {
    throw new Error("DATABASE_URL is required.");
  }

  const profile = resolveProfile(process.env.SEED_PROFILE);
  const parsedSeed = Number.parseInt(process.env.SEED_RANDOM ?? "42", 10);
  const rng = mulberry32(
    Number.isFinite(parsedSeed) ? (parsedSeed >>> 0) : 42,
  );
  const skipStorage = process.env.SEED_SKIP_STORAGE === "1";
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket =
    process.env.SUPABASE_STORAGE_BUCKET_TEMPLATE_PRODUCTS?.trim() ||
    "template-products";

  if (!skipStorage && (!supabaseUrl?.trim() || !supabaseKey?.trim())) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or SEED_SKIP_STORAGE=1.",
    );
  }

  const supabase = skipStorage
    ? null
    : createSupabaseServiceClient(supabaseUrl!, supabaseKey!);

  const pdfBytes = minimalPdfBuffer();
  const jpegBytes = (() => {
    const fixture = resolve(__dirname, "fixtures/sample-product.jpg");
    if (existsSync(fixture)) {
      return readFileSync(fixture);
    }
    return MINIMAL_JPEG;
  })();

  console.log(`Seed profile: ${profile.name}`);
  console.log(
    skipStorage
      ? "Storage uploads: SKIPPED"
      : `Storage uploads: enabled (bucket=${bucket})`,
  );

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 8,
  });
  const db = drizzle(pool, { schema });

  const now = new Date();
  const purchaseEnd = new Date(now);
  purchaseEnd.setUTCDate(purchaseEnd.getUTCDate() - 2);
  purchaseEnd.setUTCHours(23, 59, 59, 999);
  const purchaseStart = new Date(purchaseEnd);
  purchaseStart.setUTCDate(
    purchaseStart.getUTCDate() - profile.purchaseHistoryDays,
  );
  purchaseStart.setUTCHours(0, 0, 0, 0);

  const mvCount = 10;
  const machineVersionIds: string[] = [];
  for (let i = 0; i < mvCount; i++) {
    machineVersionIds.push(`seed_mv_${i.toString().padStart(2, "0")}`);
  }

  console.log("Inserting machine_version…");
  const t0 = Date.now();
  await db.insert(machineVersion).values(
    machineVersionIds.map((id, i) => ({
      id,
      versionNumber: `seed-fw-${i + 1}`,
      description: `Seed firmware line ${i + 1}`,
      createdAt: now,
      updatedAt: now,
    })),
  );

  let machineSeq = 0;
  let purchaseSeq = 0;
  type PurchaseInsert = InferInsertModel<typeof purchase>;
  const purchaseBatch: PurchaseInsert[] = [];
  const PURCHASE_CHUNK = 2500;

  async function flushPurchases(): Promise<void> {
    if (purchaseBatch.length === 0) {
      return;
    }
    await db.insert(purchase).values(purchaseBatch);
    purchaseBatch.length = 0;
  }

  const uploadTasks: { path: string; body: Buffer; contentType: string }[] = [];

  function queueUpload(path: string, body: Buffer, contentType: string): void {
    if (skipStorage) {
      return;
    }
    uploadTasks.push({ path, body, contentType });
  }

  for (let oi = 0; oi < profile.operatorCount; oi++) {
    const operatorId = `seed_op_${oi.toString().padStart(5, "0")}`;
    const slug = `seed-op-${oi.toString().padStart(5, "0")}`;

    await db.insert(organization).values({
      id: operatorId,
      name: `Seed Operator ${oi + 1}`,
      slug,
      logo: null,
      createdAt: now,
      metadata: null,
    });

    const productCount = randomIntInclusive(
      rng,
      profile.operatorProductMin,
      profile.operatorProductMax,
    );
    const productIds: string[] = [];

    for (let pi = 0; pi < productCount; pi++) {
      const productId = `seed_pr_${oi.toString().padStart(5, "0")}_${pi.toString().padStart(3, "0")}`;
      let productImageId: string | null = null;

      if (rng() < profile.productImageAttachRate) {
        productImageId = `seed_pi_${oi.toString().padStart(5, "0")}_${pi.toString().padStart(3, "0")}`;
        const objectPath = `operator-products/${productId}/${randomUUID()}.jpg`;
        queueUpload(objectPath, jpegBytes, "image/jpeg");
        await db.insert(productImage).values({
          id: productImageId,
          bucket,
          objectPath,
          createdAt: now,
          updatedAt: now,
        });
      }

      await db.insert(operatorProduct).values({
        id: productId,
        operatorId,
        name: `Product ${pi + 1} (${slug})`,
        priceInCents: randomIntInclusive(rng, 199, 899),
        taxRatePercent: rng() < 0.2 ? 7 : 19,
        productImageId,
        sourceTemplateProductId: null,
        createdAt: now,
        updatedAt: now,
      });
      productIds.push(productId);
    }

    const entityCount = pickWeighted(rng, ENTITY_COUNT_DIST);
    for (let ei = 0; ei < entityCount; ei++) {
      const businessEntityId = `seed_be_${oi.toString().padStart(5, "0")}_${ei.toString().padStart(2, "0")}`;
      await db.insert(businessEntity).values({
        id: businessEntityId,
        operatorId,
        name: `Site ${ei + 1}`,
        legalName: `Seed Legal ${oi}-${ei}`,
        legalForm: "GmbH",
        vatId: `DE${randomIntInclusive(rng, 100000000, 999999999)}`,
        street: `Industrial Rd ${ei + 1}`,
        city: "Berlin",
        postalCode: `${10000 + ((oi * 10 + ei) % 9000)}`,
        country: "DE",
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      const machinesHere = pickWeighted(rng, MACHINE_COUNT_DIST);
      for (let mi = 0; mi < machinesHere; mi++) {
        machineSeq += 1;
        const machineId = `seed_m_${machineSeq.toString().padStart(7, "0")}`;
        const operatorMachineId = `seed_om_${machineSeq.toString().padStart(7, "0")}`;
        const mvId =
          machineVersionIds[
            Math.floor(rng() * machineVersionIds.length)
          ]!;

        await db.insert(machine).values({
          id: machineId,
          machineVersionId: mvId,
          internalName: `M-${machineSeq}`,
          comments: "",
          disabled: false,
          apiKeyId: null,
          createdAt: now,
          updatedAt: now,
        });

        await db.insert(operatorMachine).values({
          id: operatorMachineId,
          operatorId,
          machineId,
          businessEntityId,
          status: "active",
          deployedAt: now,
          undeployedAt: null,
          createdAt: now,
          updatedAt: now,
        });

        const filledSlots = slotFillCount(rng);
        const slotPlan = assignSlots(rng, filledSlots, productIds);
        const slotCtx: SlotSale[] = [];

        for (const row of slotPlan) {
          const slotId = `seed_ms_${machineSeq.toString().padStart(7, "0")}_${row.slot}`;
          await db.insert(machineSlot).values({
            id: slotId,
            operatorMachineId,
            slot: row.slot,
            operatorProductId: row.operatorProductId,
            createdAt: now,
            updatedAt: now,
          });
          if (row.operatorProductId) {
            slotCtx.push({
              slotId,
              operatorProductId: row.operatorProductId,
              purchaseCount: 0,
            });
          }
        }

        const contractId = `seed_oc_${machineSeq.toString().padStart(7, "0")}`;
        await db.insert(operatorContract).values({
          id: contractId,
          operatorId,
          businessEntityId,
          operatorMachineId,
          currentVersionId: null,
          createdAt: now,
          updatedAt: now,
        });

        const versionCount = pickWeighted(rng, CONTRACT_VERSION_DIST);
        const spanMs = purchaseEnd.getTime() - purchaseStart.getTime();
        const boundaries: Date[] = [];
        boundaries.push(purchaseStart);
        for (let v = 1; v < versionCount; v++) {
          const frac = v / versionCount;
          boundaries.push(new Date(purchaseStart.getTime() + spanMs * frac));
        }
        boundaries.push(purchaseEnd);

        const contractEffectiveStart = new Date(purchaseStart);
        contractEffectiveStart.setUTCDate(contractEffectiveStart.getUTCDate() - 60);

        let lastVersionId: string | null = null;
        for (let vn = 1; vn <= versionCount; vn++) {
          const versionId = `seed_ocv_${machineSeq.toString().padStart(7, "0")}_v${vn}`;
          const effectiveDate =
            vn === 1
              ? contractEffectiveStart
              : boundaries[vn - 1]!;
          const endedAt = vn === versionCount ? null : boundaries[vn]!;

          await db.insert(operatorContractVersion).values({
            id: versionId,
            entityId: contractId,
            versionNumber: vn,
            status: "active",
            effectiveDate,
            endedAt,
            monthlyRentInCents: randomIntInclusive(rng, 20_000, 120_000),
            revenueShareBasisPoints: randomIntInclusive(rng, 800, 2500),
            notes: null,
            createdAt: now,
          });

          const pdfPath = `operator-contracts/${contractId}/versions/${versionId}/${randomUUID()}.pdf`;
          queueUpload(pdfPath, pdfBytes, "application/pdf");
          const docId = `seed_doc_${versionId}`;
          await db.insert(document).values({
            id: docId,
            kind: "contract",
            entityType: CONTRACT_VERSION_ENTITY_TYPE,
            entityId: versionId,
            bucket,
            objectPath: pdfPath,
            filename: "contract.pdf",
            mimeType: "application/pdf",
            fileSizeBytes: pdfBytes.length,
            createdAt: now,
            updatedAt: now,
          });

          lastVersionId = versionId;
        }

        await db
          .update(operatorContract)
          .set({ currentVersionId: lastVersionId })
          .where(eq(operatorContract.id, contractId));

        const totalPurchases = randomIntInclusive(
          rng,
          profile.purchasePerMachineMin,
          profile.purchasePerMachineMax,
        );
        const activeSlots = slotCtx.length;
        if (activeSlots > 0) {
          const splits = splitIntegerAcrossBins(totalPurchases, activeSlots, rng);
          for (let s = 0; s < activeSlots; s++) {
            slotCtx[s]!.purchaseCount = splits[s]!;
          }
        }

        for (const sc of slotCtx) {
          for (let p = 0; p < sc.purchaseCount; p++) {
            purchaseSeq += 1;
            purchaseBatch.push({
              id: `seed_pu_${purchaseSeq.toString().padStart(10, "0")}`,
              machineSlotId: sc.slotId,
              machineId,
              operatorId,
              businessEntityId,
              operatorProductId: sc.operatorProductId,
              amountInCents: randomIntInclusive(rng, 199, 899),
              purchasedAt: randomDateInRange(rng, purchaseStart, purchaseEnd),
              createdAt: now,
            });
            if (purchaseBatch.length >= PURCHASE_CHUNK) {
              await flushPurchases();
            }
          }
        }
      }
    }

    if ((oi + 1) % 25 === 0 || oi === profile.operatorCount - 1) {
      console.log(
        `  …operators ${oi + 1}/${profile.operatorCount} (${Math.round((Date.now() - t0) / 1000)}s elapsed)`,
      );
    }
  }

  console.log(`Executing ${uploadTasks.length} storage uploads…`);
  if (!skipStorage && supabase) {
    await runWithConcurrency(uploadTasks, 16, async (task) => {
      const { error } = await supabase.storage.from(bucket).upload(task.path, task.body, {
        contentType: task.contentType,
        upsert: true,
      });
      if (error) {
        throw error;
      }
    });
  }

  console.log(`Flushing remaining purchases (${purchaseBatch.length} in buffer + done)…`);
  await flushPurchases();

  console.log("REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_purchase_daily_summary…");
  await pool.query(
    "REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_purchase_daily_summary",
  );

  await pool.end();
  console.log(`Done. Purchase rows: ${purchaseSeq}. Total wall time: ${Math.round((Date.now() - t0) / 1000)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
