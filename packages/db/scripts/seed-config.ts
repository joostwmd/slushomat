export type SeedProfileName = "smoke" | "medium" | "heavy";

export type SeedProfile = {
  name: SeedProfileName;
  operatorCount: number;
  /** Uniform inclusive range per operator_machine */
  purchasePerMachineMin: number;
  purchasePerMachineMax: number;
  /** How far back purchases may be dated (analytics MV excludes Berlin “today”) */
  purchaseHistoryDays: number;
  /** Inclusive operator catalog size */
  operatorProductMin: number;
  operatorProductMax: number;
  /** Fraction of operator_product rows that get product_image + upload */
  productImageAttachRate: number;
};

/** 45% / 35% / 20% → 1 / 2 / 3 entities per operator */
export const ENTITY_COUNT_DIST = [
  { count: 1, p: 0.45 },
  { count: 2, p: 0.35 },
  { count: 3, p: 0.2 },
] as const;

/** Machines per business entity: 2–8 with plan weights */
export const MACHINE_COUNT_DIST = [
  { count: 2, p: 0.12 },
  { count: 3, p: 0.22 },
  { count: 4, p: 0.26 },
  { count: 5, p: 0.18 },
  { count: 6, p: 0.12 },
  { count: 7, p: 0.07 },
  { count: 8, p: 0.03 },
] as const;

/** Contract versions per deployment */
export const CONTRACT_VERSION_DIST = [
  { count: 1, p: 0.72 },
  { count: 2, p: 0.24 },
  { count: 3, p: 0.04 },
] as const;

export const PROFILES: Record<SeedProfileName, SeedProfile> = {
  smoke: {
    name: "smoke",
    operatorCount: 5,
    purchasePerMachineMin: 50,
    purchasePerMachineMax: 200,
    purchaseHistoryDays: 90,
    operatorProductMin: 5,
    operatorProductMax: 8,
    productImageAttachRate: 0.85,
  },
  medium: {
    name: "medium",
    operatorCount: 50,
    purchasePerMachineMin: 200,
    purchasePerMachineMax: 800,
    purchaseHistoryDays: 400,
    operatorProductMin: 7,
    operatorProductMax: 12,
    productImageAttachRate: 0.85,
  },
  heavy: {
    name: "heavy",
    operatorCount: 500,
    purchasePerMachineMin: 800,
    purchasePerMachineMax: 3000,
    purchaseHistoryDays: 540,
    operatorProductMin: 7,
    operatorProductMax: 14,
    productImageAttachRate: 0.85,
  },
};

export function resolveProfile(
  raw: string | undefined,
): SeedProfile {
  const name = (raw ?? "smoke").toLowerCase() as SeedProfileName;
  const p = PROFILES[name];
  if (!p) {
    throw new Error(
      `Unknown SEED_PROFILE "${raw}". Use smoke | medium | heavy.`,
    );
  }
  return p;
}
