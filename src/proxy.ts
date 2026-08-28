import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

/**
 * Gate for the whole console. Next 16 calls this file `proxy.ts`; it is the
 * successor to `middleware.ts`.
 *
 * The signature is verified here rather than merely checking the cookie exists,
 * so a fabricated cookie does not get past the gate.
 */
export async function proxy(request: NextRequest) {
  const session = await readSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  const isLogin = request.nextUrl.pathname === "/login";

  if (!session && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (session && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
