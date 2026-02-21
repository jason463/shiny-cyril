import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function BottomCTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-green-600 via-emerald-600 to-green-700 px-6 py-20 sm:py-28">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />

      <div className="relative mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Ready to ditch the spreadsheets?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-green-100">
          Start tracking your gut health today. Your future self will thank you.
        </p>

        <div className="mt-10 flex justify-center">
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-bold text-green-700 shadow-lg shadow-black/10 transition-all hover:shadow-xl hover:brightness-105"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <p className="mt-4 text-sm text-green-200">
          Free to use. No credit card required.
        </p>
      </div>
    </section>
  );
}
