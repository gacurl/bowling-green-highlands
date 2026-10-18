import {
  ADMIN_RECOVERY_MODE_ENABLED_VALUE,
  readAdminOwnerCredential,
  replaceAdminOwnerCredential,
  resolveAdminSessionCredential,
} from "./admin-credential-store";
import {
  isValidAdminSessionCookieValue,
  type AdminSessionCredential,
} from "./admin-session";

export type AdminPasswordRecoveryAuthorization =
  | "authorized"
  | "invalid_session"
  | "unavailable";

export type AdminPasswordRecoveryResult =
  | "confirmation_mismatch"
  | "invalid_new_password"
  | "invalid_session"
  | "persistence_failed"
  | "reset"
  | "unavailable";

type AdminPasswordRecoveryInput = {
  confirmation: string;
  cookieValue: string | undefined;
  newPassword: string;
};

export type AdminPasswordRecoveryOptions = {
  adminPassword: string | undefined;
  bootstrapMode?: string;
  recoveryMode: string | undefined;
  storePath?: string;
};

export type AdminPasswordRecoveryOutcome = {
  clearSession: boolean;
  redirectPath: string;
};

type AdminPasswordRecoveryAuthorizationContext =
  | {
      authorization: "authorized";
      sessionCredential: AdminSessionCredential;
    }
  | {
      authorization: "invalid_session" | "unavailable";
    };

function isValidNewPassword(password: string) {
  return password.trim().length > 0 && password === password.trim();
}

async function getAdminPasswordRecoveryAuthorizationContext(
  cookieValue: string | undefined,
  options: AdminPasswordRecoveryOptions,
): Promise<AdminPasswordRecoveryAuthorizationContext> {
  if (
    !cookieValue ||
    options.recoveryMode !== ADMIN_RECOVERY_MODE_ENABLED_VALUE
  ) {
    return { authorization: "invalid_session" };
  }

  const credentialState = await readAdminOwnerCredential(options.storePath);

  if (credentialState.kind === "unavailable") {
    return { authorization: "unavailable" };
  }

  const sessionCredential = await resolveAdminSessionCredential(options);

  if (
    !sessionCredential ||
    sessionCredential.kind !== "recovery" ||
    !(await isValidAdminSessionCookieValue(cookieValue, sessionCredential))
  ) {
    return { authorization: "invalid_session" };
  }

  return { authorization: "authorized", sessionCredential };
}

export async function authorizeAdminPasswordRecovery(
  cookieValue: string | undefined,
  options: AdminPasswordRecoveryOptions,
): Promise<AdminPasswordRecoveryAuthorization> {
  return (
    await getAdminPasswordRecoveryAuthorizationContext(cookieValue, options)
  ).authorization;
}

export async function resetAdminOwnerPasswordFromRecovery(
  input: AdminPasswordRecoveryInput,
  options: AdminPasswordRecoveryOptions,
): Promise<AdminPasswordRecoveryResult> {
  const authorization = await getAdminPasswordRecoveryAuthorizationContext(
    input.cookieValue,
    options,
  );

  if (authorization.authorization !== "authorized") {
    return authorization.authorization;
  }

  if (input.newPassword !== input.confirmation) {
    return "confirmation_mismatch";
  }

  if (!isValidNewPassword(input.newPassword)) {
    return "invalid_new_password";
  }

  const expectedSessionVersion =
    authorization.sessionCredential.sessionVersion === "recovery"
      ? null
      : authorization.sessionCredential.sessionVersion;
  const replacement = await replaceAdminOwnerCredential(
    input.newPassword,
    options.storePath,
    expectedSessionVersion,
  );

  switch (replacement.kind) {
    case "replaced":
      return "reset";
    case "invalid_password":
      return "invalid_new_password";
    case "persistence_failed":
      return "persistence_failed";
    case "unavailable":
      return "unavailable";
  }
}

export function getAdminPasswordRecoveryOutcome(
  result: AdminPasswordRecoveryResult,
): AdminPasswordRecoveryOutcome {
  switch (result) {
    case "reset":
      return {
        clearSession: true,
        redirectPath: "/admin/login?reset=1",
      };
    case "invalid_session":
      return {
        clearSession: true,
        redirectPath:
          "/admin/login?error=recovery_session_invalid",
      };
    case "unavailable":
      return {
        clearSession: true,
        redirectPath: "/admin/login?error=credential_unavailable",
      };
    default:
      return {
        clearSession: false,
        redirectPath: `/admin/password/recovery?error=${result}`,
      };
  }
}
