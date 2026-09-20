import { isValidAdminSessionCookieValue } from "./admin-session";
import type { AdminSessionCredential } from "./admin-session";

export async function shouldShowAdminNavigation(
  cookieValue: string | undefined,
  credential: AdminSessionCredential | null,
) {
  return isValidAdminSessionCookieValue(cookieValue, credential);
}
