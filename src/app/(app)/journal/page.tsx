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
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          Log Meal
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-16">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-sage-900">
                {editingId ? "Edit Entry" : "Log Meal"}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="rounded-lg p-1 text-sage-400 hover:bg-sage-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">
                  Meal
                </label>
                <div className="flex gap-2">
                  {["Breakfast", "Lunch", "Dinner", "Snack"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMealName(m)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        mealName === m
                          ? "bg-green-600 text-white"
                          : "bg-sage-100 text-sage-600 hover:bg-sage-200"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">
                  What did you eat?
                </label>
                <textarea
                  value={foods}
                  onChange={(e) => setFoods(e.target.value)}
                  placeholder="e.g., Rice with grilled chicken, steamed broccoli"
                  required
                  rows={2}
                  className="w-full rounded-lg border border-sage-200 px-4 py-2.5 text-sage-800 placeholder-sage-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">
                  Potential triggers
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {commonTriggers.map((trigger) => (
                    <button
                      key={trigger}
                      type="button"
                      onClick={() => toggleTrigger(trigger)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selectedTriggers.includes(trigger)
                          ? "bg-red-100 text-red-700"
                          : "bg-sage-100 text-sage-600 hover:bg-sage-200"
                      }`}
                    >
                      {trigger}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-2">
                  How did you feel after?
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setFeelingAfter(rating)}
                      className={`flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors ${
                        feelingAfter === rating
                          ? feelingEmojis[rating].color
                          : "bg-sage-100 text-sage-500 hover:bg-sage-200"
                      }`}
                    >
                      {feelingEmojis[rating].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional details"
                  className="w-full rounded-lg border border-sage-200 px-4 py-2.5 text-sage-800 placeholder-sage-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-green-600 py-2.5 font-medium text-white transition-colors hover:bg-green-700"
              >
                {editingId ? "Save Changes" : "Log Entry"}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-sage-400">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-sage-200 bg-white p-12 text-center">
          <UtensilsCrossed
            className="mx-auto h-12 w-12 text-sage-300"
            strokeWidth={1}
          />
          <h3 className="mt-4 text-lg font-medium text-sage-700">
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
              <h3 className="text-sm font-medium text-sage-500 mb-3">
                {date}
              </h3>
              <div className="space-y-2">
                {dateEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-sage-200 bg-white p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-medium text-sage-600">
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
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                feelingEmojis[entry.feelingAfter]?.color || ""
                              }`}
                            >
                              {feelingEmojis[entry.feelingAfter]?.label}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sage-700">{entry.foods}</p>
                        {entry.triggers && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {entry.triggers.split(",").map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600"
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
                          className="rounded-lg p-1.5 text-sage-400 hover:bg-sage-100 hover:text-sage-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {confirmingDeleteId === entry.id ? (
                          <div className="flex items-center gap-1 text-xs">
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="rounded-lg bg-red-100 px-2 py-1 font-medium text-red-600 hover:bg-red-200"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteId(null)}
                              className="rounded-lg bg-sage-100 px-2 py-1 font-medium text-sage-600 hover:bg-sage-200"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingDeleteId(entry.id)}
                            className="rounded-lg p-1.5 text-sage-400 hover:bg-red-50 hover:text-red-500"
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
