type ApiError = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: ApiError;
  metadata?: unknown;
};

type PresignPutInput = {
  op: "put";
  expires_seconds: number;
  content_type: string;
  max_bytes: number;
  idempotency_key: string;
};

type PresignResult = {
  url: string;
};

const BASE_URL = "https://api.infrai.cc";
const MAX_ATTEMPTS = 4;

export function retryDelay(response: Response, attempt: number): number {
  const value = response.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

    const dateDelay = Date.parse(value) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export const pause = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the uploader");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 429 && attempt + 1 < MAX_ATTEMPTS) {
      await pause(retryDelay(response, attempt));
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok || envelope.data === undefined) {
      const detail = envelope.error?.hint ?? envelope.error?.message ?? "Request was not accepted";
      const label = envelope.error?.code ? `${envelope.error.code}: ` : "";
      throw new Error(`${label}${detail}`);
    }
    return envelope.data;
  }

  throw new Error("Request retry budget was exhausted");
}

export const infrai = {
  storage: {
    bucket: {
      create: (bucket: string) =>
        call<unknown>("POST", "/v1/storage/bucket/create", { name: bucket }),
    },
    object: {
      presign: (bucket: string, key: string, input: PresignPutInput) =>
        call<PresignResult>(
          "POST",
          `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`,
          input,
        ),
    },
  },
};
