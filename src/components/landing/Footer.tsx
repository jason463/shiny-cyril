export default function Footer() {
  return (
    <footer className="border-t border-sage-200 bg-white px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-sm font-bold text-white">
            MG
          </div>
          <span className="font-semibold text-sage-800">MyGutPal</span>
        </div>
        <p className="text-sm text-sage-400">
          &copy; 2026 MyGutPal. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
