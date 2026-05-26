import { isValidAdminSessionCookieValue } from "./admin-session";

export async function shouldShowAdminNavigation(
  cookieValue: string | undefined,
  adminPassword: string | undefined,
) {
  return isValidAdminSessionCookieValue(cookieValue, adminPassword);
}
