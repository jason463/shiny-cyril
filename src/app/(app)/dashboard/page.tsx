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

  const medsTaken = medications.filter((m) => m.logs.length > 0).length;
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
      color: "bg-red-50 text-red-600",
    },
    {
      label: "Take Medication",
      href: "/medications",
      icon: Pill,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Start Timer",
      href: "/timer",
      icon: Timer,
      color: "bg-amber-50 text-amber-600",
    },
    {
      label: "Log Meal",
      href: "/journal",
      icon: UtensilsCrossed,
      color: "bg-green-50 text-green-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-sage-900">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1 text-sage-500">
          Here&apos;s your gut health overview for today.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col items-center gap-2 rounded-xl border border-sage-200 bg-white p-4 transition-all hover:border-green-200 hover:shadow-sm"
          >
            <div className={`rounded-lg p-2.5 ${action.color}`}>
              <action.icon className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-medium text-sage-700">
              {action.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Today's Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-sage-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-sage-500">Symptoms Today</h3>
            <Activity className="h-4 w-4 text-sage-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-sage-900">
            {todaySymptoms}
          </p>
          <Link
            href="/symptoms"
            className="mt-3 inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
          >
            Log symptoms <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-sage-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-sage-500">Medications</h3>
            <Pill className="h-4 w-4 text-sage-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-sage-900">
            {medsTaken}
            <span className="text-lg font-normal text-sage-400">
              /{totalMeds}
            </span>
          </p>
          <p className="text-sm text-sage-500">taken today</p>
          <Link
            href="/medications"
            className="mt-2 inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-sage-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-sage-500">Meals Logged</h3>
            <UtensilsCrossed className="h-4 w-4 text-sage-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-sage-900">{todayMeals}</p>
          <Link
            href="/timer"
            className="mt-3 inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
          >
            Meal timer <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-sage-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-sage-500">Active Protocols</h3>
            <CalendarDays className="h-4 w-4 text-sage-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-sage-900">
            {activeProtocols}
          </p>
          <Link
            href="/protocols"
            className="mt-3 inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
          >
            View protocols <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-sage-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-sage-500">Journal Entries</h3>
            <UtensilsCrossed className="h-4 w-4 text-sage-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-sage-900">
            {todayJournal}
          </p>
          <p className="text-sm text-sage-500">logged today</p>
          <Link
            href="/journal"
            className="mt-2 inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
          >
            Log food <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="rounded-xl border border-sage-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-sage-500">Progress</h3>
            <BarChart3 className="h-4 w-4 text-sage-400" />
          </div>
          <p className="mt-2 text-lg font-medium text-sage-700">
            View your trends
          </p>
          <Link
            href="/progress"
            className="mt-3 inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
          >
            See charts <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
