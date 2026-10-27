const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  // Never rate-limit local loopback or local testing
  if (key === "127.0.0.1" || key === "::1" || key === "localhost") {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (bucket.timestamps.length >= MAX_REQUESTS) {
    const oldest = bucket.timestamps[0];
    buckets.set(key, bucket);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000)),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0 };
}
