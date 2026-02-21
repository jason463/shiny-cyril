"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, Plus, Trash2, X } from "lucide-react";

interface Symptom {
  id: string;
  name: string;
  severity: number;
  notes: string | null;
  timestamp: string;
}

const commonSymptoms = [
  "Bloating",
  "Abdominal Pain",
  "Nausea",
  "Gas",
  "Acid Reflux",
  "Diarrhea",
  "Constipation",
  "Fatigue",
  "Brain Fog",
  "Headache",
  "Cramping",
  "Belching",
];

export default function SymptomsPage() {
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState(5);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSymptoms = useCallback(async () => {
    const res = await fetch("/api/symptoms?days=30");
    const data = await res.json();
    if (data.symptoms) setSymptoms(data.symptoms);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSymptoms();
  }, [fetchSymptoms]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;

    await fetch("/api/symptoms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, severity, notes }),
    });

    setName("");
    setSeverity(5);
    setNotes("");
    setShowForm(false);
    fetchSymptoms();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/symptoms?id=${id}`, { method: "DELETE" });
    fetchSymptoms();
  }

  function severityColor(s: number) {
    if (s <= 3) return "bg-green-100 text-green-700";
    if (s <= 6) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  }

  function severityLabel(s: number) {
    if (s <= 2) return "Mild";
    if (s <= 4) return "Moderate";
    if (s <= 6) return "Noticeable";
    if (s <= 8) return "Severe";
    return "Very Severe";
  }

  // Group symptoms by date
  const grouped = symptoms.reduce(
    (acc: Record<string, Symptom[]>, symptom) => {
      const date = new Date(symptom.timestamp).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      if (!acc[date]) acc[date] = [];
      acc[date].push(symptom);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sage-900">Symptom Tracker</h1>
          <p className="mt-1 text-sage-500">
            Log and monitor your symptoms over time
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          Log Symptom
        </button>
      </div>

      {/* Add Symptom Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-sage-900">
                Log Symptom
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-sage-400 hover:bg-sage-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">
                  Symptom
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Bloating"
                  required
                  className="w-full rounded-lg border border-sage-200 px-4 py-2.5 text-sage-800 placeholder-sage-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {commonSymptoms.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setName(s)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        name === s
                          ? "bg-green-100 text-green-700"
                          : "bg-sage-100 text-sage-600 hover:bg-sage-200"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">
                  Severity: {severity}/10{" "}
                  <span className="text-sage-400">
                    ({severityLabel(severity)})
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value))}
                  className="w-full accent-green-600"
                />
                <div className="flex justify-between text-xs text-sage-400">
                  <span>Mild</span>
                  <span>Severe</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional details..."
                  rows={2}
                  className="w-full rounded-lg border border-sage-200 px-4 py-2.5 text-sage-800 placeholder-sage-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-green-600 py-2.5 font-medium text-white transition-colors hover:bg-green-700"
              >
                Log Symptom
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Symptoms List */}
      {loading ? (
        <div className="text-center py-12 text-sage-400">Loading...</div>
      ) : symptoms.length === 0 ? (
        <div className="rounded-xl border border-sage-200 bg-white p-12 text-center">
          <Activity className="mx-auto h-12 w-12 text-sage-300" strokeWidth={1} />
          <h3 className="mt-4 text-lg font-medium text-sage-700">
            No symptoms logged yet
          </h3>
          <p className="mt-1 text-sage-500">
            Start tracking your symptoms to see trends over time.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dateSymptoms]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-sage-500 mb-3">{date}</h3>
              <div className="space-y-2">
                {dateSymptoms.map((symptom) => (
                  <div
                    key={symptom.id}
                    className="flex items-center gap-4 rounded-xl border border-sage-200 bg-white p-4"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${severityColor(
                        symptom.severity
                      )}`}
                    >
                      {symptom.severity}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sage-800">
                        {symptom.name}
                      </p>
                      {symptom.notes && (
                        <p className="mt-0.5 text-sm text-sage-500 truncate">
                          {symptom.notes}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-sage-400">
                      {new Date(symptom.timestamp).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <button
                      onClick={() => handleDelete(symptom.id)}
                      className="rounded-lg p-1.5 text-sage-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
