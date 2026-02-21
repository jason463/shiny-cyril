"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Timer, Play, Square, UtensilsCrossed, HelpCircle } from "lucide-react";

interface MealEntry {
  id: string;
  mealTime: string;
  notes: string | null;
}

export default function MealTimerPage() {
  const [interval, setIntervalHours] = useState(4);
  const [lastMealTime, setLastMealTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [recentMeals, setRecentMeals] = useState<MealEntry[]>([]);
  const [mealNote, setMealNote] = useState("");
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showMmcInfo, setShowMmcInfo] = useState(false);

  const targetSeconds = interval * 3600;

  const fetchMeals = useCallback(async () => {
    const res = await fetch("/api/meals");
    const data = await res.json();
    if (data.meals) {
      setRecentMeals(data.meals);
      // Auto-start timer from last meal
      if (data.meals.length > 0) {
        const lastTime = new Date(data.meals[0].mealTime);
        const elapsedSec = Math.floor(
          (Date.now() - lastTime.getTime()) / 1000
        );
        setLastMealTime(lastTime);
        setElapsed(elapsedSec);
        setRunning(true);
      }
    }
  }, []);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [running]);

  async function logMeal() {
    await fetch("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: mealNote || null }),
    });
    setMealNote("");
    setLastMealTime(new Date());
    setElapsed(0);
    setRunning(true);
    fetchMeals();
  }

  function stopTimer() {
    setRunning(false);
    setElapsed(0);
    setLastMealTime(null);
  }

  const progress = Math.min(elapsed / targetSeconds, 1);
  const remaining = Math.max(targetSeconds - elapsed, 0);
  const mmcReady = elapsed >= targetSeconds;

  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  }

  // SVG circle params
  const size = 280;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-sage-900">Meal Spacing Timer</h1>
        <p className="mt-1 text-sage-500">
          Track time between meals for MMC optimization
        </p>
        <button
          onClick={() => setShowMmcInfo(!showMmcInfo)}
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          What is MMC?
        </button>
        {showMmcInfo && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm leading-relaxed text-sage-700">
            The migrating motor complex (MMC) is a wave-like cleaning motion
            your gut performs between meals. It typically needs 3–5 hours of
            fasting to complete a full cycle. Spacing your meals gives your gut
            time to sweep out bacteria and debris — a key part of managing SIBO
            and other conditions.
          </div>
        )}
      </div>

      {/* Interval Selector */}
      <div className="rounded-xl border border-sage-200 bg-white p-4">
        <label className="text-sm font-medium text-sage-700">
          Meal spacing interval
        </label>
        <div className="mt-2 flex gap-2">
          {[3, 3.5, 4, 4.5, 5].map((h) => (
            <button
              key={h}
              onClick={() => setIntervalHours(h)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                interval === h
                  ? "bg-green-600 text-white"
                  : "bg-sage-100 text-sage-600 hover:bg-sage-200"
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
      </div>

      {/* Timer Display */}
      <div className="rounded-xl border border-sage-200 bg-white p-8">
        <div className="flex flex-col items-center">
          {/* Circular Timer */}
          <div className="relative">
            <svg width={size} height={size} className="-rotate-90">
              {/* Background circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#e8ebe5"
                strokeWidth={strokeWidth}
              />
              {/* Progress circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={mmcReady ? "#22c55e" : "#4ade80"}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {running ? (
                <>
                  <span
                    className={`text-4xl font-bold ${
                      mmcReady ? "text-green-600" : "text-sage-800"
                    }`}
                  >
                    {mmcReady ? formatTime(elapsed) : formatTime(remaining)}
                  </span>
                  <span className="mt-1 text-sm text-sage-500">
                    {mmcReady ? "elapsed" : "remaining"}
                  </span>
                  {mmcReady && (
                    <div className="mt-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                      MMC Complete
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Timer className="h-10 w-10 text-sage-300" strokeWidth={1} />
                  <span className="mt-2 text-sm text-sage-500">
                    Log a meal to start
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Status Message */}
          <div className="mt-6 text-center">
            {running && !mmcReady && (
              <p className="text-sage-600">
                Your gut is still cleaning. Try to wait before eating.
              </p>
            )}
            {running && mmcReady && (
              <p className="text-green-600 font-medium">
                Your MMC has completed a full cleaning cycle. You&apos;re clear
                to eat when ready.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={mealNote}
                onChange={(e) => setMealNote(e.target.value)}
                placeholder="Meal note (optional)"
                className="rounded-lg border border-sage-200 px-3 py-2 text-sm text-sage-800 placeholder-sage-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
              />
              <button
                onClick={logMeal}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                <Play className="h-4 w-4" />
                Log Meal
              </button>
            </div>
            {running && (
              <button
                onClick={stopTimer}
                className="flex items-center gap-2 rounded-lg bg-sage-100 px-4 py-2 text-sm font-medium text-sage-600 transition-colors hover:bg-sage-200"
              >
                <Square className="h-4 w-4" />
                Reset
              </button>
            )}
          </div>

          {lastMealTime && (
            <p className="mt-4 text-sm text-sage-400">
              Last meal:{" "}
              {lastMealTime.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>

      {/* Recent Meals */}
      {recentMeals.length > 0 && (
        <div className="rounded-xl border border-sage-200 bg-white p-5">
          <h3 className="font-semibold text-sage-800 mb-3">Recent Meals</h3>
          <div className="space-y-2">
            {recentMeals.slice(0, 10).map((meal) => (
              <div
                key={meal.id}
                className="flex items-center gap-3 rounded-lg bg-sage-50 p-3"
              >
                <UtensilsCrossed className="h-4 w-4 text-sage-400" />
                <div className="flex-1">
                  <span className="text-sm text-sage-700">
                    {new Date(meal.mealTime).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    at{" "}
                    {new Date(meal.mealTime).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  {meal.notes && (
                    <span className="text-sm text-sage-400 ml-2">
                      — {meal.notes}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
