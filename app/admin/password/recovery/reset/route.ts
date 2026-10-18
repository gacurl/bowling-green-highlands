import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminPasswordRecoveryOutcome,
  resetAdminOwnerPasswordFromRecovery,
} from "../../../../lib/admin-auth";
import {
  ADMIN_SESSION_COOKIE_NAME,
  getAdminSessionCookieClearOptions,
} from "../../../../lib/admin-session";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const result = await resetAdminOwnerPasswordFromRecovery(
    {
      confirmation: readFormString(formData, "confirmation"),
      cookieValue: request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value,
      newPassword: readFormString(formData, "newPassword"),
    },
    {
      adminPassword: process.env.ADMIN_PASSWORD,
      bootstrapMode: process.env.BGH_ADMIN_BOOTSTRAP_MODE,
      recoveryMode: process.env.BGH_ADMIN_RECOVERY_MODE,
    },
  );
  const outcome = getAdminPasswordRecoveryOutcome(result);
  const response = NextResponse.redirect(
    new URL(outcome.redirectPath, request.url),
  );

  if (outcome.clearSession) {
    response.cookies.set(
      ADMIN_SESSION_COOKIE_NAME,
      "",
      getAdminSessionCookieClearOptions(process.env.NODE_ENV),
    );
  }

  return response;
}
