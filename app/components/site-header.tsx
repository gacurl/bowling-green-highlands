import Link from "next/link";
import { cookies } from "next/headers";
import { shouldShowAdminNavigation } from "../lib/admin-navigation";
import { ADMIN_SESSION_COOKIE_NAME } from "../lib/admin-session";

export async function SiteHeader() {
  const cookieStore = await cookies();
  const showAdminNavigation = await shouldShowAdminNavigation(
    cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value,
    process.env.ADMIN_PASSWORD,
  );

  return (
    <header className="border-b border-[#94A378]/40 bg-[#2D3C59]">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <Link href="/" className="text-base font-semibold text-slate-50">
          Bowling Green Highlands
        </Link>
        <nav
          aria-label="Primary"
          className="flex flex-wrap items-center justify-end gap-2 text-sm sm:gap-3"
        >
          <Link className="px-2 py-1 text-slate-200 hover:text-white" href="/">
            Home
          </Link>
          <Link
            className="px-2 py-1 text-slate-200 hover:text-white"
            href="/#homepage-faq"
          >
            FAQ
          </Link>
          <Link className="px-2 py-1 text-slate-200 hover:text-white" href="/pricing">
            Pricing
          </Link>
          <Link className="px-2 py-1 text-slate-200 hover:text-white" href="/policy">
            Policy
          </Link>
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#E5BA41] px-4 py-2 font-semibold text-[#2D3C59] transition-colors hover:bg-[#D1855C] hover:text-white"
            href="/reserve"
          >
            Reserve
          </Link>
          {showAdminNavigation ? (
            <Link className="px-2 py-1 text-slate-200 hover:text-white" href="/admin">
              Admin
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
