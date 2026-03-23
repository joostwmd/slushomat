import { z } from "zod";

import {
  ANALYTICS_PRESETS,
  type AnalyticsWindowInput,
} from "./berlin-range";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const analyticsWindowFieldsSchema = z
  .object({
    preset: z.enum(ANALYTICS_PRESETS).optional(),
    startDate: ymd.optional(),
    endDate: ymd.optional(),
  })
  .superRefine((val, ctx) => {
    const hasPreset = val.preset != null;
    const hasRange =
      val.startDate != null &&
      val.endDate != null &&
      val.startDate.length > 0 &&
      val.endDate.length > 0;
    if (hasPreset === hasRange) {
      ctx.addIssue({
        code: "custom",
        message:
          "Provide exactly one of: preset, or both startDate and endDate (custom range).",
      });
    }
  });

export function toAnalyticsWindowInput(
  v: z.infer<typeof analyticsWindowFieldsSchema>,
): AnalyticsWindowInput {
  if (v.preset != null) {
    return { kind: "preset", preset: v.preset };
  }
  return {
    kind: "range",
    startDate: v.startDate!,
    endDate: v.endDate!,
  };
}
