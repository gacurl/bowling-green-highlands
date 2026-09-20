import { NextResponse } from "next/server";
import { authenticateAdminPassword } from "../../../lib/admin-auth";
import {
  ADMIN_SESSION_COOKIE_NAME,
  createAdminSessionCookieValue,
  getAdminSessionCookieOptions,
} from "../../../lib/admin-session";

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNextPath(nextValue: string) {
  if (!nextValue.startsWith("/admin")) {
    return "/admin";
  }

  if (nextValue.startsWith("/admin/login")) {
    return "/admin";
  }

  return nextValue;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = readRequiredString(formData, "password");
  const next = normalizeNextPath(readRequiredString(formData, "next"));
  const authentication = await authenticateAdminPassword(password, {
    adminPassword: process.env.ADMIN_PASSWORD,
    recoveryMode: process.env.BGH_ADMIN_RECOVERY_MODE,
  });

  if (authentication.kind === "unavailable") {
    return NextResponse.redirect(
      new URL("/admin/login?error=not_configured", request.url),
    );
  }

  if (authentication.kind === "invalid") {
    const params = new URLSearchParams({
      error: "invalid_password",
      next,
    });
    return NextResponse.redirect(new URL(`/admin/login?${params.toString()}`, request.url));
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(
    ADMIN_SESSION_COOKIE_NAME,
    await createAdminSessionCookieValue(authentication.session),
    getAdminSessionCookieOptions(process.env.NODE_ENV),
  );

  return response;
}
