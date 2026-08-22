import { createHash } from "node:crypto";

const BUCKET_PREFIX = "course-media";

export function bucketForTenant(tenantId: string): string {
  const normalized = tenantId.trim().toLowerCase();
  if (!normalized) {
    throw new Error("tenantId must not be empty");
  }

  const readable = normalized
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "tenant";
  const suffix = createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  return `${BUCKET_PREFIX}-${readable}-${suffix}`;
}

