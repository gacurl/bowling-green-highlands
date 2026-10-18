import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageShell } from "../../../components/page-shell";
import { authorizeAdminPasswordRecovery } from "../../../lib/admin-auth";
import { ADMIN_SESSION_COOKIE_NAME } from "../../../lib/admin-session";
import { getAdminPasswordRecoveryErrorMessage } from "../../../lib/operational-error-messages";

type AdminPasswordRecoveryPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function AdminPasswordRecoveryPage({
  searchParams,
}: AdminPasswordRecoveryPageProps) {
  const cookieStore = await cookies();
  const authorization = await authorizeAdminPasswordRecovery(
    cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value,
    {
      adminPassword: process.env.ADMIN_PASSWORD,
      bootstrapMode: process.env.BGH_ADMIN_BOOTSTRAP_MODE,
      recoveryMode: process.env.BGH_ADMIN_RECOVERY_MODE,
    },
  );

  if (authorization === "invalid_session") {
    redirect("/admin/login?error=recovery_session_invalid");
  }

  if (authorization === "unavailable") {
    redirect("/admin/login?error=credential_unavailable");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = getAdminPasswordRecoveryErrorMessage(
    resolvedSearchParams.error,
  );

  return (
    <PageShell
      eyebrow="Operator Recovery"
      title="Reset owner password"
      description="Choose a new password for normal owner sign-in."
      action={
        <form
          action="/admin/password/recovery/reset"
          method="post"
          className="w-full max-w-xl space-y-4 rounded-3xl border border-[#D8CDBA] bg-[#FDF8EF] p-4 shadow-sm sm:p-6"
        >
          {errorMessage ? (
            <p
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
            >
              {errorMessage}
            </p>
          ) : null}

          <div>
            <label
              htmlFor="newPassword"
              className="mb-2 block text-sm font-medium text-[#2B2922]"
            >
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              className="w-full rounded-2xl border border-[#CFC3AE] bg-white px-4 py-3 text-[#2B2922] outline-none transition focus:border-[#2F4A35]"
            />
          </div>

          <div>
            <label
              htmlFor="confirmation"
              className="mb-2 block text-sm font-medium text-[#2B2922]"
            >
              Confirm new password
            </label>
            <input
              id="confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              required
              className="w-full rounded-2xl border border-[#CFC3AE] bg-white px-4 py-3 text-[#2B2922] outline-none transition focus:border-[#2F4A35]"
            />
          </div>

          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#2F4A35] px-6 py-3 text-sm font-medium text-[#FFF8EA] transition-colors hover:bg-[#B86748]"
          >
            Reset owner password
          </button>
        </form>
      }
      actionAfterChildren={false}
    />
  );
}
