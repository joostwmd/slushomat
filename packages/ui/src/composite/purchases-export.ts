import type { PurchaseRow } from "./purchases-table";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDateCsv(d: Date): { date: string; time: string } {
  const x = d instanceof Date ? d : new Date(d);
  const date = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(x);
  const time = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(x);
  return { date, time };
}

function amountEurCsv(amountInCents: number): string {
  return (amountInCents / 100).toFixed(2);
}

/**
 * Builds CSV + ZIP in the browser and triggers download.
 * ZIP name: `purchases-<orgSlug>-<yyyy-mm-dd>.zip` with `purchases.csv` inside.
 */
export async function exportPurchasesToZip(
  rows: PurchaseRow[],
  orgSlug: string,
): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const header = [
    "Date",
    "Time",
    "Machine ID",
    "Slot",
    "Product",
    "Amount (EUR)",
    "Business Entity",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const { date, time } = formatDateCsv(
      row.purchasedAt instanceof Date
        ? row.purchasedAt
        : new Date(row.purchasedAt),
    );
    const cells = [
      csvEscape(date),
      csvEscape(time),
      csvEscape(row.machineId),
      csvEscape(row.slot),
      csvEscape(row.productName),
      csvEscape(amountEurCsv(row.amountInCents)),
      csvEscape(row.businessEntityName ?? ""),
    ];
    lines.push(cells.join(","));
  }
  const csv = lines.join("\r\n");
  const zip = new JSZip();
  zip.file("purchases.csv", csv);
  const blob = await zip.generateAsync({ type: "blob" });
  const stamp = new Date().toISOString().slice(0, 10);
  const safeSlug = orgSlug.replace(/[^a-zA-Z0-9_-]/g, "_") || "org";
  const filename = `purchases-${safeSlug}-${stamp}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
