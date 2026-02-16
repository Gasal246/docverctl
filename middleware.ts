import { NextRequest, NextResponse } from "next/server";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120);

function getClientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const now = Date.now();
  const key = `${getClientIp(req)}:${req.nextUrl.pathname}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (existing.count >= MAX_REQUESTS) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later."
      },
      { status: 429 }
    );
  }

  existing.count += 1;
  buckets.set(key, existing);
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"]
};
