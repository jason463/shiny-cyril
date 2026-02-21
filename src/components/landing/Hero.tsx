import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-green-50 via-white to-white px-6 pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-green-100 opacity-40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-sage-100 opacity-50 blur-3xl" />

      <div className="relative mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm font-medium text-green-700">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          Free while in beta
        </div>

        <h1 className="text-4xl font-bold leading-tight tracking-tight text-sage-900 sm:text-5xl lg:text-6xl">
          Your gut health journey,{" "}
          <span className="text-green-600">simplified.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-sage-600">
          Track symptoms, manage protocols, time your meals, and finally see
          your healing progress in one place. Built for people managing SIBO,
          IBS, GERD, and other gut conditions.
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

        <p className="mt-4 text-sm text-sage-400">
          Free to use. No credit card required.
        </p>
      </div>
    </section>
  );
}
