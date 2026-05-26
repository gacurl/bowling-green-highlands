import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[#94A378]/40 bg-[#2D3C59]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-4 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
        <p>Requests are reviewed before dates are confirmed.</p>
        <nav aria-label="Footer">
          <ul className="flex items-center gap-4">
            <li>
              <Link href="/pricing" className="text-slate-200 hover:text-white">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/policy" className="text-slate-200 hover:text-white">
                Policy
              </Link>
            </li>
            <li>
              <a
                href="https://www.facebook.com/p/Bowling-Green-Highlands-61586487172307/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-white"
              >
                Facebook
              </a>
            </li>
            <li>
              <Link href="/admin/login" className="text-slate-400 hover:text-slate-300">
                Farm Office
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
