import { createHash } from "node:crypto";
import { basename } from "node:path";
import { readFile } from "node:fs/promises";

import { infrai, pause, retryDelay } from "./infrai_storage.ts";
import { bucketForTenant } from "./tenant_bucket.ts";

type UploadReceipt = {
  tenantId: string;
  bucket: string;
  key: string;
  bytes: number;
};

async function putSignedUrl(url: string, contentType: string, bytes: Uint8Array): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: bytes,
    });

    if (response.status === 429 && attempt < 3) {
      await pause(retryDelay(response, attempt));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Signed upload returned HTTP ${response.status}`);
    }
    return;
  }

  throw new Error("Signed upload retry budget was exhausted");
}

export async function uploadTenantMedia(
  tenantId: string,
  filePath: string,
  contentType: string,
): Promise<UploadReceipt> {
  const bucket = bucketForTenant(tenantId);
  const bytes = await readFile(filePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const key = `media/${digest.slice(0, 16)}-${basename(filePath)}`;

  await infrai.storage.bucket.create(bucket);
  const { url } = await infrai.storage.object.presign(bucket, key, {
    op: "put",
    expires_seconds: 600,
    content_type: contentType,
    max_bytes: bytes.byteLength,
    idempotency_key: `media-${digest}`,
  });
  await putSignedUrl(url, contentType, bytes);

  return { tenantId, bucket, key, bytes: bytes.byteLength };
}

async function main(): Promise<void> {
  const [tenantId, filePath, contentType = "application/octet-stream"] = process.argv.slice(2);
  if (!tenantId || !filePath) {
    throw new Error("Usage: npm run upload -- <tenant-id> <file-path> [content-type]");
  }

  const receipt = await uploadTenantMedia(tenantId, filePath, contentType);
  console.log(JSON.stringify(receipt, null, 2));
}

const launchedFromCli = process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href;
if (launchedFromCli) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
