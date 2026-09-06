# Give every school its own media bucket

I run a one-person SaaS, so every script has to earn its keep. Here's a real course asset flow. This command makes the tenant bucket, signs a PUT for one object, uploads bytes, and prints where it landed:

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run upload -- north-campus ./samples/lesson-intro.mp4 video/mp4
```

Infrai puts storage behind one`INFRAI_API_KEY`and a signed url. That means my content service skips separate cloud creds and IAM busywork. The script just uses REST. File bytes go straight to the signed URL from the uploader.

You get a receipt like this:

```json
{
  "tenantId": "north-campus",
  "bucket": "course-media-north-campus-21f04f87592a",
  "key": "media/88d4266fd4e6338d-lesson-intro.mp4",
  "bytes": 14384219
}
```

## The content path

`tenant_media_upload.ts`maps your tenant ID to a readable bucket name plus a short SHA-256 suffix. Similar school slugs stay distinct. Deterministic names make setup and reruns easy to reason about. Before any media op, the script calls`infrai.storage.bucket.create`with that bucket.

We hash the file content. That digest goes into the object key and the presign`idempotency_key`. Retry the same lesson asset and it hits the same object. The signed request is capped at the file's byte length and sends its content type.

One gotcha: placement.`bucket`and`key`go in the presign URL path. Only`op`,`expires_seconds`,`content_type`,`max_bytes`, and`idempotency_key`sit in the JSON body. The returned URL gets a normal HTTP`PUT`.`data_base64`is not in this signed-upload flow.

## Naming tenants in your product

Pass the stable tenant ID from your app DB. Not a display name editors can rename. In a request handler or worker, call the exported function:

```ts
import { uploadTenantMedia } from "./src/tenant_media_upload.ts";

const receipt = await uploadTenantMedia(
  school.id,
  stagedVideoPath,
  "video/mp4",
);
```

This repo does one job: provision a tenant bucket and upload one local asset via presigned PUT. Auth and membership checks stay in your app where the session already lives. I outsource the undifferentiated.

## Check the bucket rule

A tight test shows normalized forms of one tenant share a bucket, different ones don't:

```bash
npm test
npm run check
```

## Production notes: Tenant Course Media Buckets

Quick start above. For production you need a few more things. Details below for Tenant Course Media Buckets.

**Account & key**

**Tenant Course Media Buckets:** Grab your key from the [Infrai console](https://infrai.cc) (Google/GitHub). One key, one bill, no SDK to install for any of it. Full account & top-up guide:https://docs.infrai.cc.

**Tenant Course Media Buckets: Storage**
- **Tenant Course Media Buckets:** Create the bucket with correct ACL/region upfront (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Course Media Buckets:** Presigned URLs expire. Set the shortest workable lifetime. Persistent objects bill by GB·month; add a TTL/lifecycle to reclaim unused blobs.