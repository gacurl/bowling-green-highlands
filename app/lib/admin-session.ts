export const ADMIN_SESSION_COOKIE_NAME = "bgh_admin_session";
const ADMIN_SESSION_PAYLOAD = "bgh-admin-session-v2";
const textEncoder = new TextEncoder();
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type AdminSessionCredential = {
  kind: "bootstrap" | "owner" | "recovery";
  sessionVersion: string;
  signingKey: string;
};

export function getAdminLoginSuccessPath(
  sessionKind: AdminSessionCredential["kind"],
  nextPath: string,
) {
  return sessionKind === "bootstrap" ? "/admin/password/setup" : nextPath;
}

async function signAdminSessionPayload(credential: AdminSessionCredential) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(credential.signingKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(
      `${ADMIN_SESSION_PAYLOAD}:${credential.kind}:${credential.sessionVersion}`,
    ),
  );

  return Buffer.from(signatureBuffer).toString("hex");
}

export function isAdminPasswordConfigured(
  adminPassword: string | undefined,
): adminPassword is string {
  return typeof adminPassword === "string" && adminPassword.trim().length > 0;
}

export async function createAdminSessionCookieValue(
  credential: AdminSessionCredential,
) {
  return signAdminSessionPayload(credential);
}

export async function isValidAdminSessionCookieValue(
  cookieValue: string | undefined,
  credential: AdminSessionCredential | null,
) {
  if (typeof cookieValue !== "string" || !credential) {
    return false;
  }

  const expectedSignature = await signAdminSessionPayload(credential);
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
