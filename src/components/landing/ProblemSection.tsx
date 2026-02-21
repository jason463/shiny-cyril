export default function ProblemSection() {
  return (
    <section className="bg-white px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <span className="inline-block rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sage-600">
            The Problem
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-sage-900 sm:text-4xl">
            Managing gut health shouldn&apos;t feel like a full-time job.
          </h2>
        </div>

        <div className="mt-12 space-y-6">
          <p className="text-lg leading-relaxed text-sage-500">
            If you&apos;re dealing with SIBO, IBS, SIFO, GERD, or any complex
            digestive condition, you already know the drill. You&apos;re juggling
            a dozen supplements with different dosing schedules. Timing meals
            around your migrating motor complex. Trying to figure out which
            foods are triggers. Tracking symptoms across phases of treatment
            that can span months.
          </p>

          <p className="text-lg leading-relaxed text-sage-500">
            Most people end up cobbling together spreadsheets, notes apps, phone
            reminders, and sheer memory to keep it all straight. Some days you
            forget a supplement. Other days you eat too soon and wonder if
            you&apos;ve set your progress back. And when your doctor asks
            &quot;how have your symptoms been?&quot; you end up guessing.
          </p>

          <div className="rounded-2xl border border-green-100 bg-gradient-to-r from-green-50 to-emerald-50 p-6">
            <p className="text-lg leading-relaxed font-medium text-sage-800">
              MyGutPal puts everything in one place — so you can focus on
              healing, not on managing the management.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
