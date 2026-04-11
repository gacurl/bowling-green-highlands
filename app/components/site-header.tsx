import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-base font-semibold text-zinc-900">
          Bowling Green Highlands
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
          <Link className="text-zinc-600 hover:text-zinc-900" href="/reserve">
            Reserve
          </Link>
          <Link className="text-zinc-600 hover:text-zinc-900" href="/admin">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
