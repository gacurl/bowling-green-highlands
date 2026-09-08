import Link from "next/link";
import packageJson from "../../package.json";

const appVersion = packageJson.version;

export function SiteFooter() {
  return (
    <footer className="border-t border-[#94A378]/50 bg-[#2F4A35]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-4 text-sm text-[#EDE4D4] sm:flex-row sm:items-center sm:justify-between">
        <p>Requests are reviewed before dates are confirmed.</p>
        <nav aria-label="Footer">
          <ul className="flex items-center gap-4">
            <li>
              <Link href="/pricing" className="text-[#F6F0E6] hover:text-white">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/policy" className="text-[#F6F0E6] hover:text-white">
                Policy
              </Link>
            </li>
            <li>
              <a
                href="https://www.facebook.com/p/Bowling-Green-Highlands-61586487172307/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#EDE4D4] hover:text-white"
              >
                Facebook
              </a>
            </li>
            <li>
              <Link href="/admin/login" className="text-[#CFC3AE] hover:text-[#EDE4D4]">
                Farm Office
              </Link>
            </li>
            <li className="text-[#AFA28D]" aria-label={`Application version ${appVersion}`}>
              v{appVersion}
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
