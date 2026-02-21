"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface Symptom {
  id: string;
  name: string;
  severity: number;
  timestamp: string;
}

interface JournalEntry {
  id: string;
  feelingAfter: number | null;
  triggers: string | null;
  timestamp: string;
}

interface MealLog {
  id: string;
  mealTime: string;
}

export default function ProgressPage() {
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [symptomsRes, journalRes, mealsRes] = await Promise.all([
      fetch(`/api/symptoms?days=${days}`),
      fetch(`/api/journal?days=${days}`),
      fetch("/api/meals"),
    ]);
    const [symptomsData, journalData, mealsData] = await Promise.all([
      symptomsRes.json(),
      journalRes.json(),
      mealsRes.json(),
    ]);
    if (symptomsData.symptoms) setSymptoms(symptomsData.symptoms);
    if (journalData.entries) setJournal(journalData.entries);
    if (mealsData.meals) setMeals(mealsData.meals);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Process symptom data for trend chart - average severity per day
  const symptomTrend = (() => {
    const byDate: Record<string, { total: number; count: number }> = {};

    symptoms.forEach((s) => {
      const date = new Date(s.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!byDate[date]) byDate[date] = { total: 0, count: 0 };
      byDate[date].total += s.severity;
      byDate[date].count++;
    });

    return Object.entries(byDate)
      .map(([date, { total, count }]) => ({
        date,
        avgSeverity: Math.round((total / count) * 10) / 10,
        count,
      }))
      .reverse();
  })();

  // Process symptom frequency
  const symptomFrequency = (() => {
    const counts: Record<string, number> = {};
    symptoms.forEach((s) => {
      counts[s.name] = (counts[s.name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  })();

  // Trigger frequency from journal
  const triggerFrequency = (() => {
    const counts: Record<string, number> = {};
    journal.forEach((entry) => {
      if (entry.triggers) {
        entry.triggers.split(",").forEach((t) => {
          const trigger = t.trim();
          if (trigger) counts[trigger] = (counts[trigger] || 0) + 1;
        });
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  })();

  // Meal feeling distribution
  const feelingDistribution = (() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    journal.forEach((entry) => {
      if (entry.feelingAfter) counts[entry.feelingAfter]++;
    });
    const labels: Record<number, string> = {
      1: "Terrible",
      2: "Bad",
      3: "Okay",
      4: "Good",
      5: "Great",
    };
    return Object.entries(counts).map(([rating, count]) => ({
      name: labels[parseInt(rating)],
      value: count,
    }));
  })();

  const COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

  // Meal timing consistency
  const mealTimingData = (() => {
    const gaps: number[] = [];
    const sorted = [...meals].sort(
      (a, b) =>
        new Date(a.mealTime).getTime() - new Date(b.mealTime).getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      const gap =
        (new Date(sorted[i].mealTime).getTime() -
          new Date(sorted[i - 1].mealTime).getTime()) /
        (1000 * 60 * 60);
      if (gap > 0 && gap < 24) gaps.push(Math.round(gap * 10) / 10);
    }
    // Bucket into ranges
    const buckets: Record<string, number> = {
      "< 3h": 0,
      "3-4h": 0,
      "4-5h": 0,
      "> 5h": 0,
    };
    gaps.forEach((g) => {
      if (g < 3) buckets["< 3h"]++;
      else if (g < 4) buckets["3-4h"]++;
      else if (g < 5) buckets["4-5h"]++;
      else buckets["> 5h"]++;
    });
    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
    }));
  })();

  const hasData =
    symptoms.length > 0 || journal.length > 0 || meals.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sage-900">
            Progress Dashboard
          </h1>
          <p className="mt-1 text-sage-500">
            Visualize your gut health trends over time
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                days === d
                  ? "bg-green-600 text-white"
                  : "bg-sage-100 text-sage-600 hover:bg-sage-200"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sage-400">Loading...</div>
      ) : !hasData ? (
        <div className="rounded-xl border border-sage-200 bg-white p-12 text-center">
          <BarChart3
            className="mx-auto h-12 w-12 text-sage-300"
            strokeWidth={1}
          />
          <h3 className="mt-4 text-lg font-medium text-sage-700">
            No data to display yet
          </h3>
          <p className="mt-1 text-sage-500">
            Start logging symptoms, meals, and journal entries to see your
            progress charts.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Symptom Severity Trend */}
          {symptomTrend.length > 0 && (
            <div className="rounded-xl border border-sage-200 bg-white p-5 lg:col-span-2">
              <h3 className="font-semibold text-sage-800 mb-4">
                Symptom Severity Trend
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={symptomTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ebe5" />
                  <XAxis
                    dataKey="date"
                    fontSize={12}
                    tick={{ fill: "#7a8770" }}
                  />
                  <YAxis
                    domain={[0, 10]}
                    fontSize={12}
                    tick={{ fill: "#7a8770" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #d4d9cf",
                      fontSize: "13px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgSeverity"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: "#22c55e", r: 4 }}
                    name="Avg Severity"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Symptom Frequency */}
          {symptomFrequency.length > 0 && (
            <div className="rounded-xl border border-sage-200 bg-white p-5">
              <h3 className="font-semibold text-sage-800 mb-4">
                Most Frequent Symptoms
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={symptomFrequency} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ebe5" />
                  <XAxis type="number" fontSize={12} tick={{ fill: "#7a8770" }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    fontSize={12}
                    tick={{ fill: "#7a8770" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #d4d9cf",
                      fontSize: "13px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#4ade80"
                    radius={[0, 4, 4, 0]}
                    name="Count"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trigger Frequency */}
          {triggerFrequency.length > 0 && (
            <div className="rounded-xl border border-sage-200 bg-white p-5">
              <h3 className="font-semibold text-sage-800 mb-4">
                Most Tagged Triggers
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={triggerFrequency} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ebe5" />
                  <XAxis type="number" fontSize={12} tick={{ fill: "#7a8770" }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={80}
                    fontSize={12}
                    tick={{ fill: "#7a8770" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #d4d9cf",
                      fontSize: "13px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#f97316"
                    radius={[0, 4, 4, 0]}
                    name="Times Tagged"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Feeling After Meals */}
          {journal.some((e) => e.feelingAfter) && (
            <div className="rounded-xl border border-sage-200 bg-white p-5">
              <h3 className="font-semibold text-sage-800 mb-4">
                Post-Meal Feeling Distribution
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={feelingDistribution.filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    fontSize={12}
                  >
                    {feelingDistribution.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #d4d9cf",
                      fontSize: "13px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Meal Timing */}
          {mealTimingData.some((d) => d.count > 0) && (
            <div className="rounded-xl border border-sage-200 bg-white p-5">
              <h3 className="font-semibold text-sage-800 mb-4">
                Meal Spacing Distribution
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={mealTimingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ebe5" />
                  <XAxis
                    dataKey="range"
                    fontSize={12}
                    tick={{ fill: "#7a8770" }}
                  />
                  <YAxis fontSize={12} tick={{ fill: "#7a8770" }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #d4d9cf",
                      fontSize: "13px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#22c55e"
                    radius={[4, 4, 0, 0]}
                    name="Meal Gaps"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Summary Stats */}
          <div className="rounded-xl border border-sage-200 bg-white p-5 lg:col-span-2">
            <h3 className="font-semibold text-sage-800 mb-4">
              Summary ({days}-Day Window)
            </h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-sage-50 p-4 text-center">
                <p className="text-2xl font-bold text-sage-800">
                  {symptoms.length}
                </p>
                <p className="text-sm text-sage-500">Symptoms Logged</p>
              </div>
              <div className="rounded-lg bg-sage-50 p-4 text-center">
                <p className="text-2xl font-bold text-sage-800">
                  {symptoms.length > 0
                    ? (
                        symptoms.reduce((sum, s) => sum + s.severity, 0) /
                        symptoms.length
                      ).toFixed(1)
                    : "—"}
                </p>
                <p className="text-sm text-sage-500">Avg Severity</p>
              </div>
              <div className="rounded-lg bg-sage-50 p-4 text-center">
                <p className="text-2xl font-bold text-sage-800">
                  {journal.length}
                </p>
                <p className="text-sm text-sage-500">Journal Entries</p>
              </div>
              <div className="rounded-lg bg-sage-50 p-4 text-center">
                <p className="text-2xl font-bold text-sage-800">
                  {meals.length}
                </p>
                <p className="text-sm text-sage-500">Meals Logged</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
