import {
  initializeAdminOwnerCredential,
  readAdminOwnerCredential,
  resolveAdminSessionCredential,
} from "./admin-credential-store";
import { isValidAdminSessionCookieValue } from "./admin-session";

export type AdminPasswordSetupAuthorization =
  | "authorized"
  | "invalid_session"
  | "unavailable";

export type AdminPasswordSetupResult =
  | "confirmation_mismatch"
  | "initialized"
  | "invalid_new_password"
  | "invalid_session"
  | "persistence_failed"
  | "unavailable";

type AdminPasswordSetupInput = {
  confirmation: string;
  cookieValue: string | undefined;
  newPassword: string;
};

export type AdminPasswordSetupOptions = {
  adminPassword: string | undefined;
  bootstrapMode: string | undefined;
  recoveryMode: string | undefined;
  storePath?: string;
};

export type AdminPasswordSetupOutcome = {
  clearSession: boolean;
  redirectPath: string;
};

function isValidNewPassword(password: string) {
  return password.trim().length > 0 && password === password.trim();
}

export async function authorizeAdminPasswordSetup(
  cookieValue: string | undefined,
  options: AdminPasswordSetupOptions,
): Promise<AdminPasswordSetupAuthorization> {
  if (!cookieValue) {
    return "invalid_session";
  }

  const credentialState = await readAdminOwnerCredential(options.storePath);

  if (credentialState.kind === "unavailable") {
    return "unavailable";
  }

  if (credentialState.kind === "ready") {
    return "invalid_session";
  }

  const sessionCredential = await resolveAdminSessionCredential(options);

  if (!sessionCredential) {
    return "invalid_session";
  }

  if (sessionCredential.kind !== "bootstrap") {
    return "invalid_session";
  }

  return (await isValidAdminSessionCookieValue(cookieValue, sessionCredential))
    ? "authorized"
    : "invalid_session";
}

export async function setupAdminOwnerPassword(
  input: AdminPasswordSetupInput,
  options: AdminPasswordSetupOptions,
): Promise<AdminPasswordSetupResult> {
  const authorization = await authorizeAdminPasswordSetup(
    input.cookieValue,
    options,
  );

  if (authorization !== "authorized") {
    return authorization;
  }

  if (input.newPassword !== input.confirmation) {
    return "confirmation_mismatch";
  }

  if (!isValidNewPassword(input.newPassword)) {
    return "invalid_new_password";
  }

  const initialization = await initializeAdminOwnerCredential(
    input.newPassword,
    options.storePath,
  );

  switch (initialization.kind) {
    case "initialized":
      return "initialized";
    case "invalid_password":
      return "invalid_new_password";
    case "persistence_failed":
      return "persistence_failed";
    case "already_initialized":
      return "invalid_session";
    case "unavailable":
      return "unavailable";
  }
}

export function getAdminPasswordSetupOutcome(
  result: AdminPasswordSetupResult,
): AdminPasswordSetupOutcome {
  switch (result) {
    case "initialized":
      return {
        clearSession: true,
        redirectPath: "/admin/login?setup=1",
      };
    case "invalid_session":
      return {
        clearSession: true,
        redirectPath: "/admin/login?error=setup_session_invalid",
      };
    case "unavailable":
      return {
        clearSession: true,
        redirectPath: "/admin/login?error=credential_unavailable",
      };
    default:
      return {
        clearSession: false,
        redirectPath: `/admin/password/setup?error=${result}`,
      };
  }
}
