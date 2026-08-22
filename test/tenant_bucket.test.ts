import assert from "node:assert/strict";
import test from "node:test";

import { bucketForTenant } from "../src/tenant_bucket.ts";

test("maps a tenant to a stable, isolated content bucket", () => {
  const first = bucketForTenant("North Campus");
  const again = bucketForTenant(" north campus ");
  const other = bucketForTenant("South Campus");

  assert.equal(first, again);
  assert.notEqual(first, other);
  assert.match(first, /^course-media-north-campus-[a-f0-9]{12}$/);
});

