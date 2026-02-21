import {
  Activity,
  Pill,
  Timer,
  CalendarDays,
  UtensilsCrossed,
  BarChart3,
} from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Symptom Tracker",
    description:
      "Log symptoms daily with severity ratings, notes, and timestamps. See trends over time so you know what's actually improving.",
  },
  {
    icon: Pill,
    title: "Medication & Supplement Manager",
    description:
      "Keep track of complex dosing schedules across multiple supplements and medications. Never miss a dose or wonder if you already took it.",
  },
  {
    icon: Timer,
    title: "Meal Spacing Timer",
    description:
      "Countdown timer that tracks the gap between meals for MMC optimization. Know exactly when it's safe to eat again.",
  },
  {
    icon: CalendarDays,
    title: "Protocol Timeline",
    description:
      "Map out multi-phase treatment protocols and track your progress through each stage. See the big picture of your healing journey.",
  },
  {
    icon: UtensilsCrossed,
    title: "Food & Trigger Journal",
    description:
      "Log meals, tag potential triggers, and rate how you felt after eating. Build your personal map of safe and risky foods.",
  },
  {
    icon: BarChart3,
    title: "Progress Dashboard",
    description:
      "Charts showing symptom trends, protocol adherence, and meal timing consistency. Finally have real data for your next doctor visit.",
  },
];

export default function FeaturesGrid() {
  return (
    <section className="bg-sage-50 px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-sage-900 sm:text-4xl">
            Everything you need to manage your gut health
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-sage-600">
            Stop juggling spreadsheets, apps, and sticky notes. MyGutPal brings
            it all together.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-sage-200 bg-white p-6 transition-all hover:border-green-200 hover:shadow-md"
            >
              <div className="mb-4 inline-flex rounded-lg bg-green-50 p-2.5 text-green-600 transition-colors group-hover:bg-green-100">
                <feature.icon className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-sage-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-sage-500">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
