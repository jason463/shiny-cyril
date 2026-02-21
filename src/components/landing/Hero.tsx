import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-green-50 via-emerald-50/30 to-white px-6 pt-32 pb-24 sm:pt-40 sm:pb-32">
      {/* Decorative elements */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-green-200/60 to-emerald-100/40 blur-3xl animate-float" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-sage-200/50 to-green-100/30 blur-3xl animate-float-delayed" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-gradient-to-b from-green-100/20 to-transparent blur-3xl" />

      <div className="relative mx-auto max-w-3xl text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-green-200/60 bg-white/80 px-4 py-2 text-sm font-medium text-green-700 shadow-sm backdrop-blur-sm">
          <Sparkles className="h-3.5 w-3.5" />
          Free while in beta
        </div>

        <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-sage-900 sm:text-5xl lg:text-6xl">
          Your gut health journey,{" "}
          <span className="text-gradient">simplified.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-sage-500">
          Track symptoms, manage protocols, time your meals, and finally see
          your healing progress in one place. Built for people managing SIBO,
          IBS, GERD, and other gut conditions.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-green-600/25 transition-all hover:shadow-xl hover:shadow-green-600/30 hover:brightness-110"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <p className="mt-5 text-sm text-sage-400">
          No credit card required. Start tracking in under a minute.
        </p>
      </div>
    </section>
  );
}
