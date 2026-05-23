import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-[#94A378]/40 bg-[#2D3C59]">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-base font-semibold text-slate-50">
          Bowling Green Highlands
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
          <Link className="text-[#94A378] hover:text-[#E5BA41]" href="/reserve">
            Reserve
          </Link>
          <Link className="text-[#94A378] hover:text-[#E5BA41]" href="/admin">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
