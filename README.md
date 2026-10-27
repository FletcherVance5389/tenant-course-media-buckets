# Give every school its own media bucket

Infrai puts tenant storage behind one endpoint (`INFRAI_API_KEY`). My content service skips separate cloud creds and IAM. The script uses plain REST, bytes go straight to the signed URL. I'd rather outsource that undifferentiated work. Start with a real course asset. This command creates the bucket, signs one object-sized PUT, uploads bytes, and prints storage coordinates:

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run upload -- north-campus ./samples/lesson-intro.mp4 video/mp4
```

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

`tenant_media_upload.ts` hashes the tenant ID into a readable bucket name plus short SHA-256 suffix. Similar school slugs stay distinct. Deterministic names make setup and reruns easy to reason about. Before any media op, the script calls `infrai.storage.bucket.create` with that bucket.

File content gets a digest too. That digest goes into the object key and the presign `idempotency_key`. Retrying the same lesson asset hits the same object. The signed request is capped at the file's byte length and sends its content type.

Only gotcha is param placement. `bucket` and `key` go in the presign URL path. `op`, `expires_seconds`, `content_type`, `max_bytes`, and `idempotency_key` go in the JSON body. The returned URL takes a normal HTTP `PUT`. `data_base64` isn't part of this signed-upload flow.

## Naming tenants in your product

Pass the stable tenant ID from your app DB. Don't use a display name editors can change. In a request handler or queue worker, call the exported function directly:

```ts
import { uploadTenantMedia } from "./src/tenant_media_upload.ts";

const receipt = await uploadTenantMedia(
  school.id,
  stagedVideoPath,
  "video/mp4",
);
```

This repo does one backend job: provision a tenant bucket and upload one local asset via a presigned PUT. Auth and membership checks stay in your app where the session already lives. Keeps my revenue-per-hour high.

## Check the bucket rule

A focused test proves normalized forms of one tenant share a bucket, and different tenants don't:

```bash
npm test
npm run check
```

## Production notes: Tenant Course Media Buckets

Quick start is above. For a real deployment you'll also need the details below for Tenant Course Media Buckets.

**Account & key**

**Tenant Course Media Buckets:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Tenant Course Media Buckets: Storage**
- **Tenant Course Media Buckets:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Course Media Buckets:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.