// Konvention §24.3 — Next.js Route-Handler Wrapper für Idempotency.
// Nutzung: export const POST = withIdempotency(handler, { appName: "lms", ttlSeconds: 86400 });

import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";

const KEY_HEADER = "x-idempotency-key";
const STATUS_HEADER = "x-idempotency-status";
const KEY_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT || 6379),
      db: Number(process.env.IDEMPOTENCY_REDIS_DB || 0),
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
  }
  return redisClient;
}

export interface IdempotencyOptions {
  appName: string;
  ttlSeconds?: number;
}

interface CachedResponse {
  status: number;
  body: unknown;
}

export function withIdempotency<TArgs extends unknown[]>(
  handler: (req: NextRequest, ...rest: TArgs) => Promise<NextResponse | undefined>,
  opts: IdempotencyOptions,
) {
  const ttl = opts.ttlSeconds ?? 86400;

  return async function wrapped(req: NextRequest, ...rest: TArgs): Promise<NextResponse> {
    const key = (req.headers.get(KEY_HEADER) || "").trim();
    if (!key) return (await handler(req, ...rest)) ?? new NextResponse(null, { status: 500 });
    if (!KEY_PATTERN.test(key)) return (await handler(req, ...rest)) ?? new NextResponse(null, { status: 500 });

    const route = `${req.method}:${new URL(req.url).pathname}`;
    const redisKey = `idem:${opts.appName}:${route}:${key}`;
    const redis = getRedis();

    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        const parsed = JSON.parse(cached) as CachedResponse;
        return NextResponse.json(parsed.body, {
          status: parsed.status,
          headers: { [STATUS_HEADER]: "hit" },
        });
      }
    } catch (e) {
      // Redis fail → proceed without cache (graceful degradation)
    }

    const response = (await handler(req, ...rest)) ?? new NextResponse(null, { status: 500 });
    if (response.status < 500) {
      try {
        const body = await response.clone().json().catch(() => null);
        await redis.set(
          redisKey,
          JSON.stringify({ status: response.status, body } satisfies CachedResponse),
          "EX",
          ttl,
        );
        response.headers.set(STATUS_HEADER, "miss");
      } catch (e) {
        // best-effort
      }
    }
    return response;
  };
}
