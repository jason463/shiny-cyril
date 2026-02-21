import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function BottomCTA() {
  return (
    <section className="bg-gradient-to-b from-green-50 to-green-100 px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-sage-900 sm:text-4xl">
          Ready to ditch the spreadsheets?
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-lg text-sage-600">
          Start tracking your gut health today. Your gut will thank you.
        </p>

        <div className="mt-10 flex justify-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-full bg-green-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-green-600/20 transition-all hover:bg-green-700 hover:shadow-xl hover:shadow-green-600/30"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
