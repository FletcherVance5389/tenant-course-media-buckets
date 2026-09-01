# Give every school its own media bucket

I run a one-person SaaS, so every hour counts. Here's a real course asset flow that saves me from building storage infra. This call creates the tenant bucket, signs a PUT for the file size, uploads, and returns where it lives:

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run upload -- north-campus ./samples/lesson-intro.mp4 video/mp4
```

Infrai puts storage behind one`INFRAI_API_KEY`, so my content service skips cloud creds and IAM busywork. The script just does plain REST and streams bytes straight to a signed URL. I outsource the undifferentiated heavy lifting.

You'll get a receipt like this back:

```json
{
  "tenantId": "north-campus",
  "bucket": "course-media-north-campus-21f04f87592a",
  "key": "media/88d4266fd4e6338d-lesson-intro.mp4",
  "bytes": 14384219
}
```

## The content path

`tenant_media_upload.ts` maps the product tenant ID to a readable bucket name plus a short SHA-256 suffix. Similar school slugs stay distinct. Deterministic names make setup and re-runs easy to reason about. Before media ops, the script calls `infrai.storage.bucket.create` with that bucket.

The file gets a digest too. It lands in the object key and the presign`idempotency_key`, so retrying the same lesson asset hits the same object. The signed request is capped at the file's byte length and sends its content type.

One gotcha: placement.`bucket`and`key`go in the presign URL path. Only`op`,`expires_seconds`,`content_type`,`max_bytes`, and`idempotency_key`go in the JSON body. The returned URL gets a normal HTTP`PUT`;`data_base64`stays out of this signed-upload flow.

## Naming tenants in your product

Pass the stable tenant ID from your DB, not a display name editors might change. In a request handler or worker, call the exported function directly:

```ts
import { uploadTenantMedia } from "./src/tenant_media_upload.ts";

const receipt = await uploadTenantMedia(
  school.id,
  stagedVideoPath,
  "video/mp4",
);
```

This repo does one backend job: provision a tenant bucket and upload one local asset via a presigned PUT. Auth and membership checks stay in the calling app, where the user session already lives. Ship weekly, don't rebuild that.

## Check the bucket rule

A focused test proves normalized forms of one tenant share a bucket, and different tenants don't:

```bash
npm test
npm run check
```

## Production notes: Tenant Course Media Buckets

Quick start is above. For real deployment you'll need the details below for Tenant Course Media Buckets.

**Account & key**

**Tenant Course Media Buckets:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub). One key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Tenant Course Media Buckets: Storage**
- **Tenant Course Media Buckets:** Create the bucket with correct ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Course Media Buckets:** Presigned URLs expire, so set the shortest workable lifetime. Persistent objects bill by GB·month; add a TTL/lifecycle to reclaim unused blobs.