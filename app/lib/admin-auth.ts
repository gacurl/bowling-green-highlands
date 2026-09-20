import "server-only";

export {
  authenticateAdminPassword,
  initializeAdminOwnerCredential,
  readAdminOwnerCredential,
  replaceAdminOwnerCredential,
  resolveAdminSessionCredential,
  verifyAdminOwnerPassword,
} from "./admin-credential-store";
export type {
  AdminAuthenticationResult,
  AdminOwnerCredentialReadResult,
  InitializeAdminOwnerCredentialResult,
  ReplaceAdminOwnerCredentialResult,
} from "./admin-credential-store";
export {
  changeAdminOwnerPassword,
  getAdminPasswordChangeOutcome,
} from "./admin-password-change";
export {
  authorizeAdminPasswordSetup,
  getAdminPasswordSetupOutcome,
  setupAdminOwnerPassword,
} from "./admin-password-setup";
