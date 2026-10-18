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
  authorizeAdminPasswordRecovery,
  getAdminPasswordRecoveryOutcome,
  resetAdminOwnerPasswordFromRecovery,
} from "./admin-password-recovery";
export {
  authorizeAdminPasswordSetup,
  getAdminPasswordSetupOutcome,
  setupAdminOwnerPassword,
} from "./admin-password-setup";
