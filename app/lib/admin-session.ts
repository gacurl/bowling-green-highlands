export const ADMIN_SESSION_COOKIE_NAME = "bgh_admin_session";
const ADMIN_SESSION_PAYLOAD = "bgh-admin-session-v1";
const textEncoder = new TextEncoder();
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

async function signAdminSessionPayload(adminPassword: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(adminPassword),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(ADMIN_SESSION_PAYLOAD),
  );

  return Buffer.from(signatureBuffer).toString("hex");
}

export function isAdminPasswordConfigured(
  adminPassword: string | undefined,
): adminPassword is string {
  return typeof adminPassword === "string" && adminPassword.trim().length > 0;
}

export async function createAdminSessionCookieValue(adminPassword: string) {
  return signAdminSessionPayload(adminPassword);
}

export async function isValidAdminSessionCookieValue(
  cookieValue: string | undefined,
  adminPassword: string | undefined,
) {
  if (
    typeof cookieValue !== "string" ||
    !isAdminPasswordConfigured(adminPassword)
  ) {
    return false;
  }

  const expectedSignature = await signAdminSessionPayload(adminPassword);
  return cookieValue === expectedSignature;
}

export function getAdminSessionCookieOptions(nodeEnv: string | undefined) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: nodeEnv === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  };
}

export function getAdminSessionCookieClearOptions(nodeEnv: string | undefined) {
  return {
    ...getAdminSessionCookieOptions(nodeEnv),
    maxAge: 0,
  };
}
