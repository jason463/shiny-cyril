"use client";

import { useState, useEffect, useCallback } from "react";
import { UtensilsCrossed, Plus, X, Trash2, Pencil } from "lucide-react";

interface JournalEntry {
  id: string;
  mealName: string;
  foods: string;
  triggers: string | null;
  feelingAfter: number | null;
  notes: string | null;
  timestamp: string;
}

const feelingEmojis: Record<number, { label: string; color: string }> = {
  1: { label: "Terrible", color: "bg-red-100 text-red-700" },
  2: { label: "Bad", color: "bg-orange-100 text-orange-700" },
  3: { label: "Okay", color: "bg-amber-100 text-amber-700" },
  4: { label: "Good", color: "bg-lime-100 text-lime-700" },
  5: { label: "Great", color: "bg-green-100 text-green-700" },
};

const commonTriggers = [
  "Gluten",
  "Dairy",
  "Garlic",
  "Onion",
  "Sugar",
  "Alcohol",
  "Caffeine",
  "Spicy",
  "High FODMAP",
  "Fatty",
  "Raw",
  "Fermented",
];

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [mealName, setMealName] = useState("Breakfast");
  const [foods, setFoods] = useState("");
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [feelingAfter, setFeelingAfter] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    const res = await fetch("/api/journal?days=30");
    const data = await res.json();
    if (data.entries) setEntries(data.entries);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  function openForm(entry?: JournalEntry) {
    if (entry) {
      setEditingId(entry.id);
      setMealName(entry.mealName);
      setFoods(entry.foods);
      setSelectedTriggers(entry.triggers ? entry.triggers.split(",") : []);
      setFeelingAfter(entry.feelingAfter);
      setNotes(entry.notes || "");
    } else {
      setEditingId(null);
      setMealName("Breakfast");
      setFoods("");
      setSelectedTriggers([]);
      setFeelingAfter(null);
      setNotes("");
    }
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!foods) return;

    const payload = {
      mealName,
      foods,
      triggers: selectedTriggers.join(",") || null,
      feelingAfter,
      notes,
    };

    if (editingId) {
      await fetch("/api/journal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...payload }),
      });
    } else {
      await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setShowForm(false);
    setEditingId(null);
    setMealName("Breakfast");
    setFoods("");
    setSelectedTriggers([]);
    setFeelingAfter(null);
    setNotes("");
    fetchEntries();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/journal?id=${id}`, { method: "DELETE" });
    setConfirmingDeleteId(null);
    fetchEntries();
  }

  function toggleTrigger(trigger: string) {
    setSelectedTriggers((prev) =>
      prev.includes(trigger)
        ? prev.filter((t) => t !== trigger)
        : [...prev, trigger]
    );
  }

  const grouped = entries.reduce(
    (acc: Record<string, JournalEntry[]>, entry) => {
      const date = new Date(entry.timestamp).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      if (!acc[date]) acc[date] = [];
      acc[date].push(entry);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sage-900">
            Food & Trigger Journal
          </h1>
          <p className="mt-1 text-sage-500">
            Log meals and identify trigger foods
          </p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-600/20 transition-all hover:shadow-lg hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Log Meal
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 backdrop-blur-sm p-4 pt-16 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-sage-900">
                {editingId ? "Edit Entry" : "Log Meal"}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="rounded-xl p-1.5 text-sage-400 hover:bg-sage-50 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-sage-700 mb-1.5">
                  Meal
                </label>
                <div className="flex gap-2">
                  {["Breakfast", "Lunch", "Dinner", "Snack"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMealName(m)}
                      className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
                        mealName === m
                          ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-sm"
                          : "bg-sage-100 text-sage-600 hover:bg-sage-200"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-sage-700 mb-1.5">
                  What did you eat?
                </label>
                <textarea
                  value={foods}
                  onChange={(e) => setFoods(e.target.value)}
                  placeholder="e.g., Rice with grilled chicken, steamed broccoli"
                  required
                  rows={2}
                  className="w-full rounded-xl border border-sage-200 bg-white px-4 py-3 text-sage-800 placeholder-sage-400 outline-none transition-all focus:border-green-400 focus:ring-4 focus:ring-green-100/60"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-sage-700 mb-1.5">
                  Potential triggers
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {commonTriggers.map((trigger) => (
                    <button
                      key={trigger}
                      type="button"
                      onClick={() => toggleTrigger(trigger)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        selectedTriggers.includes(trigger)
                          ? "bg-red-100 text-red-700 shadow-sm"
                          : "bg-sage-100 text-sage-600 hover:bg-sage-200"
                      }`}
                    >
                      {trigger}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-sage-700 mb-2">
                  How did you feel after?
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setFeelingAfter(rating)}
                      className={`flex-1 rounded-xl py-2.5 text-center text-sm font-semibold transition-all ${
                        feelingAfter === rating
                          ? `${feelingEmojis[rating].color} shadow-sm`
                          : "bg-sage-100 text-sage-500 hover:bg-sage-200"
                      }`}
                    >
                      {feelingEmojis[rating].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-sage-700 mb-1.5">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional details"
                  className="w-full rounded-xl border border-sage-200 bg-white px-4 py-3 text-sage-800 placeholder-sage-400 outline-none transition-all focus:border-green-400 focus:ring-4 focus:ring-green-100/60"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 py-3 font-semibold text-white shadow-md shadow-green-600/20 transition-all hover:shadow-lg hover:brightness-110"
              >
                {editingId ? "Save Changes" : "Log Entry"}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-sage-400">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-sage-200/80 bg-white p-16 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-50">
            <UtensilsCrossed className="h-8 w-8 text-sage-300" strokeWidth={1.5} />
          </div>
          <h3 className="mt-4 text-lg font-bold text-sage-700">
            No journal entries yet
          </h3>
          <p className="mt-1 text-sage-500">
            Start logging your meals to identify patterns and triggers.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dateEntries]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-sage-400 mb-3">
                {date}
              </h3>
              <div className="space-y-2">
                {dateEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-sage-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-semibold text-sage-600">
                            {entry.mealName}
                          </span>
                          <span className="text-xs text-sage-400">
                            {new Date(entry.timestamp).toLocaleTimeString(
                              "en-US",
                              { hour: "numeric", minute: "2-digit" }
                            )}
                          </span>
                          {entry.feelingAfter && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                feelingEmojis[entry.feelingAfter]?.color || ""
                              }`}
                            >
                              {feelingEmojis[entry.feelingAfter]?.label}
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-sage-700">{entry.foods}</p>
                        {entry.triggers && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {entry.triggers.split(",").map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {entry.notes && (
                          <p className="mt-1 text-sm text-sage-400">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openForm(entry)}
                          className="rounded-xl p-1.5 text-sage-400 hover:bg-sage-50 hover:text-sage-600 transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {confirmingDeleteId === entry.id ? (
                          <div className="flex items-center gap-1 text-xs">
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="rounded-lg bg-red-100 px-2.5 py-1 font-medium text-red-600 hover:bg-red-200 transition-colors"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteId(null)}
                              className="rounded-lg bg-sage-100 px-2.5 py-1 font-medium text-sage-600 hover:bg-sage-200 transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingDeleteId(entry.id)}
                            className="rounded-xl p-1.5 text-sage-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
