"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, Plus, Trash2, X, Pencil } from "lucide-react";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
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

  function openForm(symptom?: Symptom) {
    if (symptom) {
      setEditingId(symptom.id);
      setName(symptom.name);
      setSeverity(symptom.severity);
      setNotes(symptom.notes || "");
    } else {
      setEditingId(null);
      setName("");
      setSeverity(5);
      setNotes("");
    }
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;

    if (editingId) {
      await fetch("/api/symptoms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, name, severity, notes }),
      });
    } else {
      await fetch("/api/symptoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, severity, notes }),
      });
    }

    setShowForm(false);
    setEditingId(null);
    setName("");
    setSeverity(5);
    setNotes("");
    fetchSymptoms();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/symptoms?id=${id}`, { method: "DELETE" });
    setConfirmingDeleteId(null);
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
          onClick={() => openForm()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-600/20 transition-all hover:shadow-lg hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Log Symptom
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-sage-900">
                {editingId ? "Edit Symptom" : "Log Symptom"}
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
                  Symptom
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Bloating"
                  required
                  className="w-full rounded-xl border border-sage-200 bg-white px-4 py-3 text-sage-800 placeholder-sage-400 outline-none transition-all focus:border-green-400 focus:ring-4 focus:ring-green-100/60"
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {commonSymptoms.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setName(s)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                        name === s
                          ? "bg-green-100 text-green-700 shadow-sm"
                          : "bg-sage-100 text-sage-600 hover:bg-sage-200"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-sage-700 mb-1.5">
                  Severity: {severity}/10{" "}
                  <span className="font-normal text-sage-400">
                    ({severityLabel(severity)})
                  </span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-sage-400 mt-1">
                  <span>Mild</span>
                  <span>Severe</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-sage-700 mb-1.5">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional details..."
                  rows={2}
                  className="w-full rounded-xl border border-sage-200 bg-white px-4 py-3 text-sage-800 placeholder-sage-400 outline-none transition-all focus:border-green-400 focus:ring-4 focus:ring-green-100/60"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 py-3 font-semibold text-white shadow-md shadow-green-600/20 transition-all hover:shadow-lg hover:brightness-110"
              >
                {editingId ? "Save Changes" : "Log Symptom"}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-sage-400">Loading...</div>
      ) : symptoms.length === 0 ? (
        <div className="rounded-2xl border border-sage-200/80 bg-white p-16 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-50">
            <Activity className="h-8 w-8 text-sage-300" strokeWidth={1.5} />
          </div>
          <h3 className="mt-4 text-lg font-bold text-sage-700">
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
              <h3 className="text-sm font-semibold text-sage-400 mb-3">{date}</h3>
              <div className="space-y-2">
                {dateSymptoms.map((symptom) => (
                  <div
                    key={symptom.id}
                    className="flex items-center gap-4 rounded-2xl border border-sage-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${severityColor(
                        symptom.severity
                      )}`}
                    >
                      {symptom.severity}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sage-800">
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
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openForm(symptom)}
                        className="rounded-xl p-1.5 text-sage-400 hover:bg-sage-50 hover:text-sage-600 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {confirmingDeleteId === symptom.id ? (
                        <div className="flex items-center gap-1 text-xs">
                          <button
                            onClick={() => handleDelete(symptom.id)}
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
                          onClick={() => setConfirmingDeleteId(symptom.id)}
                          className="rounded-xl p-1.5 text-sage-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
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
