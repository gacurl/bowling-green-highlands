import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE_NAME,
  createAdminSessionCookieValue,
  getAdminSessionCookieOptions,
  isAdminPasswordConfigured,
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
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!isAdminPasswordConfigured(adminPassword)) {
    return NextResponse.redirect(
      new URL("/admin/login?error=not_configured", request.url),
    );
  }

  if (password !== adminPassword) {
    const params = new URLSearchParams({
      error: "invalid_password",
      next,
    });
    return NextResponse.redirect(new URL(`/admin/login?${params.toString()}`, request.url));
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(
    ADMIN_SESSION_COOKIE_NAME,
    await createAdminSessionCookieValue(adminPassword),
    getAdminSessionCookieOptions(process.env.NODE_ENV),
  );

  return response;
}
