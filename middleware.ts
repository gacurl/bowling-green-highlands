import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  shouldRedirectToAdminLogin,
} from "./app/lib/admin-guard";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const redirectPath = await shouldRedirectToAdminLogin(
    pathname,
    search,
    request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value,
    process.env.ADMIN_PASSWORD,
  );

  if (!redirectPath) {
    return NextResponse.next();
  }

  const redirectUrl = new URL(redirectPath, request.url);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
