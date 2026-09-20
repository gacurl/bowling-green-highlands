import {
  authenticateAdminPassword,
  replaceAdminOwnerCredential,
  resolveAdminSessionCredential,
} from "./admin-credential-store";
import { isValidAdminSessionCookieValue } from "./admin-session";

export type AdminPasswordChangeResult =
  | "changed"
  | "confirmation_mismatch"
  | "incorrect_current_password"
  | "invalid_new_password"
  | "owner_mode_required"
  | "persistence_failed"
  | "unauthenticated"
  | "unavailable";

type AdminPasswordChangeInput = {
  confirmation: string;
  cookieValue: string | undefined;
  currentPassword: string;
  newPassword: string;
};

type AdminPasswordChangeOptions = {
  adminPassword: string | undefined;
  recoveryMode: string | undefined;
  storePath?: string;
};

export type AdminPasswordChangeOutcome = {
  clearSession: boolean;
  redirectPath: string;
};

function isValidNewPassword(password: string) {
  return password.trim().length > 0 && password === password.trim();
}

export async function changeAdminOwnerPassword(
  input: AdminPasswordChangeInput,
  options: AdminPasswordChangeOptions,
): Promise<AdminPasswordChangeResult> {
  if (!input.cookieValue) {
    return "unauthenticated";
  }

  const sessionCredential = await resolveAdminSessionCredential(options);

  if (!sessionCredential) {
    return "unavailable";
  }

  if (
    !(await isValidAdminSessionCookieValue(
      input.cookieValue,
      sessionCredential,
    ))
  ) {
    return "unauthenticated";
  }

  if (sessionCredential.kind !== "owner") {
    return "owner_mode_required";
  }

  const currentAuthentication = await authenticateAdminPassword(
    input.currentPassword,
    options,
  );

  if (currentAuthentication.kind === "unavailable") {
    return "unavailable";
  }

  if (currentAuthentication.kind === "invalid") {
    return "incorrect_current_password";
  }

  if (
    currentAuthentication.session.kind !== "owner" ||
    currentAuthentication.session.sessionVersion !==
      sessionCredential.sessionVersion
  ) {
    return "unauthenticated";
  }

  if (input.newPassword !== input.confirmation) {
    return "confirmation_mismatch";
  }

  if (!isValidNewPassword(input.newPassword)) {
    return "invalid_new_password";
  }

  const replacement = await replaceAdminOwnerCredential(
    input.newPassword,
    options.storePath,
    sessionCredential.sessionVersion,
  );

  if (replacement.kind === "replaced") {
    return "changed";
  }

  if (replacement.kind === "persistence_failed") {
    return "persistence_failed";
  }

  if (replacement.kind === "invalid_password") {
    return "invalid_new_password";
  }

  return "unavailable";
}

export function getAdminPasswordChangeOutcome(
  result: AdminPasswordChangeResult,
): AdminPasswordChangeOutcome {
  switch (result) {
    case "changed":
      return {
        clearSession: true,
        redirectPath: "/admin/login?changed=1",
      };
    case "unauthenticated":
      return {
        clearSession: true,
        redirectPath:
          "/admin/login?error=session_invalid&next=%2Fadmin%2Fpassword",
      };
    case "unavailable":
      return {
        clearSession: true,
        redirectPath: "/admin/login?error=credential_unavailable",
      };
    default:
      return {
        clearSession: false,
        redirectPath: `/admin/password?error=${result}`,
      };
  }
}
