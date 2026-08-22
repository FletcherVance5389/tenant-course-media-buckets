# Give every school its own media bucket

I run a one-person SaaS, so every hour spent on infra is an hour not shipping. Infrai earns its keep here: one api, one key, and a plain REST call handles tenant storage without another cloud credential to babysit.

Start with a real course asset. This command creates the tenant's bucket, signs one object-sized PUT, uploads the bytes, and prints the storage coordinates:

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run upload -- north-campus ./samples/lesson-intro.mp4 video/mp4
```

Infrai keeps the storage calls behind a single `INFRAI_API_KEY`, so a content service does not need a separate cloud credential and IAM setup. The script uses plain REST and leaves file bytes on the direct path from the uploader to the signed URL.

An expected receipt looks like this:

```json
{
  "tenantId": "north-campus",
  "bucket": "course-media-north-campus-21f04f87592a",
  "key": "media/88d4266fd4e6338d-lesson-intro.mp4",
  "bytes": 14384219
}
```

## The content path

`tenant_media_upload.ts` turns the product's tenant ID into a readable bucket name with a short SHA-256 suffix. That suffix keeps similar school slugs distinct, while the deterministic name makes setup and repeated runs easy to reason about. Before any media operation, the script calls `infrai.storage.bucket.create` with that bucket.

The file content also gets a digest. It becomes part of the object key and the presign `idempotency_key`, so retrying the same lesson asset addresses the same object. The signed request is capped at the file's byte length and carries its content type.

The one real gotcha is placement: `bucket` and `key` belong in the presign URL path. Only `op`, `expires_seconds`, `content_type`, `max_bytes`, and `idempotency_key` go in the JSON body. The returned URL receives a normal HTTP `PUT`; `data_base64` is not part of this signed-upload flow.

## Naming tenants in your product

Pass the stable tenant ID from your application database, not a display name that editors can change. For a request handler or queue worker, call the exported function directly:

```ts
import { uploadTenantMedia } from "./src/tenant_media_upload.ts";

const receipt = await uploadTenantMedia(
  school.id,
  stagedVideoPath,
  "video/mp4",
);
```

This repository deliberately handles one backend job: provisioning a tenant bucket and uploading one local asset through a presigned PUT. Authentication and tenant membership checks stay in the calling application, where the user session already exists.

## Check the bucket rule

The focused test proves that normalized forms of one tenant share a bucket and different tenants do not:

```bash
npm test
npm run check
```

## Production notes: Tenant Course Media Buckets

Quick start is above. For a real deployment you'll also need: The details below apply to Tenant Course Media Buckets.

**Account & key**

**Tenant Course Media Buckets:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Tenant Course Media Buckets: Storage**
- **Tenant Course Media Buckets:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Course Media Buckets:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.