import Link from "next/link";
import { PageShell } from "../../components/page-shell";
import { getAdminPasswordChangeErrorMessage } from "../../lib/operational-error-messages";

type AdminPasswordPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function AdminPasswordPage({
  searchParams,
}: AdminPasswordPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = getAdminPasswordChangeErrorMessage(
    resolvedSearchParams.error,
  );

  return (
    <PageShell
      eyebrow="Operator Area"
      title="Change Admin password"
      description="Enter your current password, then choose the password you will use next time."
      action={
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#CFC3AE] bg-[#FDF8EF] px-6 py-3 text-sm font-medium text-[#2B2922] transition-colors hover:bg-[#F6F0E6]"
        >
          Back to admin
        </Link>
      }
    >
      <form
        action="/admin/password/change"
        method="post"
        className="max-w-xl space-y-4 rounded-3xl border border-[#D8CDBA] bg-[#FDF8EF] p-4 shadow-sm sm:p-6"
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
            htmlFor="currentPassword"
            className="mb-2 block text-sm font-medium text-[#2B2922]"
          >
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-2xl border border-[#CFC3AE] bg-white px-4 py-3 text-[#2B2922] outline-none transition focus:border-[#2F4A35]"
          />
        </div>

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
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#2F4A35] px-6 py-3 text-sm font-medium text-[#FFF8EA] transition-colors hover:bg-[#B86748] sm:w-auto"
        >
          Change password
        </button>
      </form>
    </PageShell>
  );
}
