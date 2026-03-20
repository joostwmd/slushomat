import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getProductImageStorage } from "./product-image";

/** Contract PDFs use the same Supabase bucket as product images. */
export const CONTRACT_PDF_MAX_BYTES = 10 * 1024 * 1024;

export const ALLOWED_CONTRACT_PDF_TYPES = new Set(["application/pdf"]);

export function pathPrefixOperatorContractVersion(
  contractId: string,
  versionId: string,
): string {
  return `operator-contracts/${contractId}/versions/${versionId}/`;
}

export { getProductImageStorage };

export async function createContractPdfUploadPath(
  contractId: string,
  versionId: string,
  contentType: string,
): Promise<{
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
}> {
  const ct = contentType.toLowerCase().split(";")[0]!.trim();
  if (!ALLOWED_CONTRACT_PDF_TYPES.has(ct)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only application/pdf is allowed for contract PDFs.",
    });
  }
  const storage = getProductImageStorage();
  const objectPath = `${pathPrefixOperatorContractVersion(contractId, versionId)}${randomUUID()}.pdf`;
  const { path, token, signedUrl } = await storage.createSignedUploadUrl(
    objectPath,
    { upsert: true },
  );
  return {
    bucket: storage.bucketName,
    path,
    token,
    signedUrl,
  };
}
