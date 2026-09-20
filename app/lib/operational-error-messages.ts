export type ReserveErrorCode =
  | "configuration"
  | "delivery"
  | "persistence"
  | "validation";

export type OperationalMessage = {
  title: string;
  body: string;
};

export function getReserveErrorMessage(
  error: string | undefined,
): OperationalMessage | null {
  switch (error) {
    case "configuration":
      return {
        title: "The request could not be sent.",
        body: "Your request was not saved. Please contact us directly so we can help.",
      };
    case "delivery":
      return {
        title: "The request was saved, but the email could not be sent.",
        body: "Please contact us directly so we can follow up on the saved request.",
      };
    case "persistence":
      return {
        title: "The request could not be saved.",
        body: "Please try again. If it still does not work, contact us directly.",
      };
    case "validation":
      return {
        title: "The request could not be sent.",
        body: "Check your name, email, and selected time, then try again.",
      };
    default:
      return null;
  }
}

export function getAdminLoginErrorMessage(error: string | undefined) {
  if (error === "invalid_password") {
    return "Password did not match. Try again.";
  }

  if (error === "not_configured") {
    return "Admin login is not ready. Ask the site operator to check setup.";
  }

  if (error === "session_invalid") {
    return "Your Admin session is no longer valid. Sign in again.";
  }

  if (error === "credential_unavailable") {
    return "Admin password access is unavailable. Ask the site operator to check setup.";
  }

  return null;
}

export function getAdminLoginStatusMessage(changed: string | undefined) {
  return changed === "1"
    ? "Password changed. Sign in again with your new password."
    : null;
}

export function getAdminPasswordChangeErrorMessage(error: string | undefined) {
  switch (error) {
    case "incorrect_current_password":
      return "Current password did not match. No change was made.";
    case "confirmation_mismatch":
      return "New password and confirmation must match. No change was made.";
    case "invalid_new_password":
      return "Enter a new password that is not blank and has no spaces at the beginning or end.";
    case "persistence_failed":
      return "Password could not be changed. Your current password still works. Try again.";
    case "owner_mode_required":
      return "Password changes are available only after signing in with the owner password during normal operation.";
    default:
      return null;
  }
}

export function getAdminActionErrorMessage(
  error: string | undefined,
): OperationalMessage | null {
  switch (error) {
    case "request_not_found":
      return {
        title: "That request could not be found.",
        body: "Return to the request list and try again.",
      };
    case "availability_load":
      return {
        title: "Availability could not be loaded.",
        body: "Refresh the page before changing dates. If it repeats, check the saved availability records.",
      };
    case "requests_load":
      return {
        title: "Reservation requests could not be loaded.",
        body: "Refresh the page before reviewing requests. Availability controls are still shown if they loaded.",
      };
    default:
      return null;
  }
}

export function getRequestStatusErrorMessage(
  error: string | undefined,
): OperationalMessage | null {
  switch (error) {
    case "action_failed":
      return {
        title: "The request status could not be saved.",
        body: "No status change was saved. Go back to admin, refresh, and try again.",
      };
    case "invalid_status":
      return {
        title: "The request status could not be saved.",
        body: "Use one of the available actions and try again.",
      };
    case "invalid_transition":
      return {
        title: "This request status is already set.",
        body: "No status change was saved. Go back to admin to review the current request list.",
      };
    case "slot_conflict":
      return {
        title: "Another request is already accepted for this slot.",
        body: "No status change was saved. Decline this request or review the accepted request first.",
      };
    default:
      return null;
  }
}
