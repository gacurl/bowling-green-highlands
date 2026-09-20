import "server-only";

export {
  authenticateAdminPassword,
  readAdminOwnerCredential,
  replaceAdminOwnerCredential,
  resolveAdminSessionCredential,
  verifyAdminOwnerPassword,
} from "./admin-credential-store";
export type {
  AdminAuthenticationResult,
  AdminOwnerCredentialReadResult,
  ReplaceAdminOwnerCredentialResult,
} from "./admin-credential-store";
