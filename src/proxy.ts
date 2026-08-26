import { type NextRequest, NextResponse } from "next/server";

/**
 * The landing page varies per viewer, so it cannot be statically cached. The
 * anonymous version is the one that gets the traffic, and it is identical for
 * everyone, so let the reverse proxy hold onto it briefly. Anything with a
 * session cookie stays private and uncached.
 */
export default function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const hasSession = request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("session_token"));

  if (hasSession) {
    response.headers.set("Cache-Control", "private, no-store");
  } else {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );
  }

  return response;
}

export const config = {
  matcher: ["/", "/all"],
};
