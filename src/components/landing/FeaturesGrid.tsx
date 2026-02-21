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
    iconColor: "text-red-500",
    bg: "bg-red-50",
  },
  {
    icon: Pill,
    title: "Medication Manager",
    description:
      "Keep track of complex dosing schedules across multiple supplements and medications. Never miss a dose or wonder if you already took it.",
    iconColor: "text-blue-500",
    bg: "bg-blue-50",
  },
  {
    icon: Timer,
    title: "Meal Spacing Timer",
    description:
      "Countdown timer that tracks the gap between meals for MMC optimization. Know exactly when it's safe to eat again.",
    iconColor: "text-amber-500",
    bg: "bg-amber-50",
  },
  {
    icon: CalendarDays,
    title: "Protocol Timeline",
    description:
      "Map out multi-phase treatment protocols and track your progress through each stage. See the big picture of your healing journey.",
    iconColor: "text-purple-500",
    bg: "bg-purple-50",
  },
  {
    icon: UtensilsCrossed,
    title: "Food & Trigger Journal",
    description:
      "Log meals, tag potential triggers, and rate how you felt after eating. Build your personal map of safe and risky foods.",
    iconColor: "text-green-500",
    bg: "bg-green-50",
  },
  {
    icon: BarChart3,
    title: "Progress Dashboard",
    description:
      "Charts showing symptom trends, protocol adherence, and meal timing consistency. Finally have real data for your next doctor visit.",
    iconColor: "text-teal-500",
    bg: "bg-teal-50",
  },
];

export default function FeaturesGrid() {
  return (
    <section className="relative bg-sage-50 px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-green-700">
            Features
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-sage-900 sm:text-4xl">
            Everything you need to manage your gut health
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-sage-500">
            Stop juggling spreadsheets, apps, and sticky notes. MyGutPal brings
            it all together.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-2xl border border-sage-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-sage-200/50 hover:-translate-y-1"
            >
              <div className={`mb-4 inline-flex rounded-xl ${feature.bg} p-3`}>
                <feature.icon
                  className={`h-6 w-6 ${feature.iconColor}`}
                  strokeWidth={1.5}
                />
              </div>
              <h3 className="text-lg font-bold text-sage-900">
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
