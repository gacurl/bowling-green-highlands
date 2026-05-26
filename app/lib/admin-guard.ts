import {
  ADMIN_SESSION_COOKIE_NAME,
  isValidAdminSessionCookieValue,
} from "./admin-session";

export function isProtectedAdminPath(pathname: string) {
  if (!pathname.startsWith("/admin")) {
    return false;
  }

  return pathname !== "/admin/login" && pathname !== "/admin/login/submit";
}

export function getAdminRedirectPath(pathname: string, search: string) {
  const next = `${pathname}${search}`;
  const params = new URLSearchParams({ next });
  return `/admin/login?${params.toString()}`;
}

export async function hasValidAdminSessionFromRequest(
  cookieValue: string | undefined,
  adminPassword: string | undefined,
) {
  return isValidAdminSessionCookieValue(cookieValue, adminPassword);
}

export async function shouldRedirectToAdminLogin(
  pathname: string,
  search: string,
  cookieValue: string | undefined,
  adminPassword: string | undefined,
) {
  if (!isProtectedAdminPath(pathname)) {
    return null;
  }

  if (await hasValidAdminSessionFromRequest(cookieValue, adminPassword)) {
    return null;
  }

  return getAdminRedirectPath(pathname, search);
}

export { ADMIN_SESSION_COOKIE_NAME };
