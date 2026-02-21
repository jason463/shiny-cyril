import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-sage-100 bg-white px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 sm:flex-row">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-sm font-bold text-white shadow-sm">
            MG
          </div>
          <span className="font-bold text-sage-800">MyGutPal</span>
        </Link>
        <p className="text-sm text-sage-400">
          &copy; 2026 MyGutPal. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
