import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Activity,
  Pill,
  Timer,
  UtensilsCrossed,
  CalendarDays,
  BarChart3,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todaySymptoms, medications, todayMeals, activeProtocols, todayJournal] =
    await Promise.all([
      prisma.symptom.count({
        where: { userId: user.id, timestamp: { gte: today } },
      }),
      prisma.medication.findMany({
        where: { userId: user.id, active: true },
        include: {
          logs: {
            where: { takenAt: { gte: today } },
          },
        },
      }),
      prisma.mealLog.count({
        where: { userId: user.id, mealTime: { gte: today } },
      }),
      prisma.protocol.count({
        where: { userId: user.id, active: true },
      }),
      prisma.journalEntry.count({
        where: { userId: user.id, timestamp: { gte: today } },
      }),
    ]);

  const medsTaken = medications.filter((m: (typeof medications)[number]) => m.logs.length > 0).length;
  const totalMeds = medications.length;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  const firstName = user.name?.split(" ")[0] || "there";

  const quickActions = [
    {
      label: "Log Symptom",
      href: "/symptoms",
      icon: Activity,
      iconColor: "text-red-500",
      bg: "bg-red-50",
      hoverBorder: "hover:border-red-200",
    },
    {
      label: "Take Medication",
      href: "/medications",
      icon: Pill,
      iconColor: "text-blue-500",
      bg: "bg-blue-50",
      hoverBorder: "hover:border-blue-200",
    },
    {
      label: "Start Timer",
      href: "/timer",
      icon: Timer,
      iconColor: "text-amber-500",
      bg: "bg-amber-50",
      hoverBorder: "hover:border-amber-200",
    },
    {
      label: "Log Meal",
      href: "/journal",
      icon: UtensilsCrossed,
      iconColor: "text-green-500",
      bg: "bg-green-50",
      hoverBorder: "hover:border-green-200",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 p-6 sm:p-8 text-white shadow-lg shadow-green-600/15">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-green-200" />
            <span className="text-sm font-medium text-green-200">Today&apos;s Overview</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-green-100">
            Here&apos;s your gut health snapshot for today.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={`group flex flex-col items-center gap-3 rounded-2xl border border-sage-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${action.hoverBorder}`}
          >
            <div className={`rounded-xl p-3 ${action.bg} transition-transform duration-300 group-hover:scale-110`}>
              <action.icon className={`h-5 w-5 ${action.iconColor}`} strokeWidth={1.5} />
            </div>
            <span className="text-sm font-semibold text-sage-700">
              {action.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Today's Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="group rounded-2xl border border-sage-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-sage-500">Symptoms Today</h3>
            <div className="rounded-lg bg-red-50 p-1.5">
              <Activity className="h-4 w-4 text-red-400" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-sage-900">
            {todaySymptoms}
          </p>
          <Link
            href="/symptoms"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
          >
            Log symptoms <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="group rounded-2xl border border-sage-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-sage-500">Medications</h3>
            <div className="rounded-lg bg-blue-50 p-1.5">
              <Pill className="h-4 w-4 text-blue-400" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-sage-900">
            {medsTaken}
            <span className="text-lg font-normal text-sage-300">
              /{totalMeds}
            </span>
          </p>
          <p className="text-sm text-sage-400">taken today</p>
          <Link
            href="/medications"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
          >
            View all <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="group rounded-2xl border border-sage-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-sage-500">Meals Logged</h3>
            <div className="rounded-lg bg-amber-50 p-1.5">
              <UtensilsCrossed className="h-4 w-4 text-amber-400" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-sage-900">{todayMeals}</p>
          <Link
            href="/timer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
          >
            Meal timer <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="group rounded-2xl border border-sage-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-sage-500">Active Protocols</h3>
            <div className="rounded-lg bg-purple-50 p-1.5">
              <CalendarDays className="h-4 w-4 text-purple-400" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-sage-900">
            {activeProtocols}
          </p>
          <Link
            href="/protocols"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
          >
            View protocols <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="group rounded-2xl border border-sage-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-sage-500">Journal Entries</h3>
            <div className="rounded-lg bg-green-50 p-1.5">
              <UtensilsCrossed className="h-4 w-4 text-green-400" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-sage-900">
            {todayJournal}
          </p>
          <p className="text-sm text-sage-400">logged today</p>
          <Link
            href="/journal"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
          >
            Log food <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="group rounded-2xl border border-sage-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-sage-500">Progress</h3>
            <div className="rounded-lg bg-teal-50 p-1.5">
              <BarChart3 className="h-4 w-4 text-teal-400" />
            </div>
          </div>
          <p className="mt-3 text-lg font-semibold text-sage-700">
            View your trends
          </p>
          <Link
            href="/progress"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
          >
            See charts <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
