import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "hzerp_session";
const SUPPORT_COOKIE = "hzerp_support";
const PLATFORM_COOKIE = "hzerp_platform";

/**
 * Edge gate. Cookies are only checked for presence here — the real check
 * (database lookup, expiry, membership, role) runs on Node in every page,
 * action and route. Also passes the request path to server components, which
 * use it for sign-in redirects and the support-view access log.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/app")) {
    if (!request.cookies.has(SESSION_COOKIE) && !request.cookies.has(SUPPORT_COOKIE)) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(login);
    }
  }

  if (pathname.startsWith("/platform") && pathname !== "/platform/login") {
    if (!request.cookies.has(PLATFORM_COOKIE)) {
      return NextResponse.redirect(new URL("/platform/login", request.url));
    }
  }

  const headers = new Headers(request.headers);
  headers.set("x-hzerp-path", `${pathname}${search}`.slice(0, 500));
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|.*\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml|woff2?)$).*)"],
};
