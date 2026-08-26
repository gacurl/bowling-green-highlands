import { PageShell } from "../../components/page-shell";
import { getAdminLoginErrorMessage } from "../../lib/operational-error-messages";

type AdminLoginPageProps = {
  searchParams?: Promise<{ error?: string; next?: string }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = getAdminLoginErrorMessage(resolvedSearchParams.error);
  const next = resolvedSearchParams.next ?? "/admin";

  return (
    <PageShell
      eyebrow="Operator Area"
      title="Admin Login"
      description="Enter the admin password to open operator tools."
      action={
        <form
          action="/admin/login/submit"
          method="post"
          className="w-full rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
        >
          {errorMessage ? (
            <p
              role="alert"
              className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
            >
              {errorMessage}
            </p>
          ) : null}
          <input type="hidden" name="next" value={next} />
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-zinc-900"
          >
            Admin password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-zinc-900 outline-none transition focus:border-zinc-500"
          />
          <button
            type="submit"
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
          >
            Continue to admin
          </button>
        </form>
      }
      actionAfterChildren={false}
    />
  );
}
