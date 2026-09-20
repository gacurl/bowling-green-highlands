import { NextResponse, type NextRequest } from "next/server";
import { resolveAdminSessionCredential } from "./app/lib/admin-auth";
import {
  ADMIN_SESSION_COOKIE_NAME,
  shouldRedirectToAdminLogin,
} from "./app/lib/admin-guard";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCredential = await resolveAdminSessionCredential({
    adminPassword: process.env.ADMIN_PASSWORD,
    bootstrapMode: process.env.BGH_ADMIN_BOOTSTRAP_MODE,
    recoveryMode: process.env.BGH_ADMIN_RECOVERY_MODE,
  });
  const redirectPath = await shouldRedirectToAdminLogin(
    pathname,
    search,
    request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value,
    sessionCredential,
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
