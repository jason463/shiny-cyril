"use client";

import { useState, useEffect, useCallback } from "react";
import { Pill, Plus, Check, X, Trash2, Pencil } from "lucide-react";

interface MedicationLog {
  id: string;
  takenAt: string;
  skipped: boolean;
}

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timeOfDay: string | null;
  notes: string | null;
  active: boolean;
  logs: MedicationLog[];
}

export default function MedicationsPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("Once daily");
  const [timeOfDay, setTimeOfDay] = useState("Morning");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchMedications = useCallback(async () => {
    const res = await fetch("/api/medications");
    const data = await res.json();
    if (data.medications) setMedications(data.medications);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMedications();
  }, [fetchMedications]);

  function openForm(med?: Medication) {
    if (med) {
      setEditingId(med.id);
      setName(med.name);
      setDosage(med.dosage);
      setFrequency(med.frequency);
      setTimeOfDay(med.timeOfDay || "Morning");
      setNotes(med.notes || "");
    } else {
      setEditingId(null);
      setName("");
      setDosage("");
      setFrequency("Once daily");
      setTimeOfDay("Morning");
      setNotes("");
    }
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !dosage) return;

    const payload = { name, dosage, frequency, timeOfDay, notes };

    if (editingId) {
      await fetch("/api/medications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...payload }),
      });
    } else {
      await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setShowForm(false);
    setEditingId(null);
    setName("");
    setDosage("");
    setFrequency("Once daily");
    setTimeOfDay("Morning");
    setNotes("");
    fetchMedications();
  }

  async function handleLogDose(medicationId: string, skipped: boolean) {
    await fetch("/api/medications/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medicationId, skipped }),
    });
    fetchMedications();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/medications?id=${id}`, { method: "DELETE" });
    setConfirmingDeleteId(null);
    fetchMedications();
  }

  const activeMeds = medications.filter((m) => m.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sage-900">
            Medication & Supplement Manager
          </h1>
          <p className="mt-1 text-sage-500">
            Track your medications and supplements
          </p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          Add Medication
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-sage-900">
                {editingId ? "Edit Medication" : "Add Medication / Supplement"}
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
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Rifaximin, Berberine"
                  required
                  className="w-full rounded-lg border border-sage-200 px-4 py-2.5 text-sage-800 placeholder-sage-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">
                  Dosage
                </label>
                <input
                  type="text"
                  value={dosage}
                  onChange={(e) => setDosage(e.target.value)}
                  placeholder="e.g., 550mg, 2 capsules"
                  required
                  className="w-full rounded-lg border border-sage-200 px-4 py-2.5 text-sage-800 placeholder-sage-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full rounded-lg border border-sage-200 px-4 py-2.5 text-sage-800 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                  >
                    <option>Once daily</option>
                    <option>Twice daily</option>
                    <option>Three times daily</option>
                    <option>With meals</option>
                    <option>Before meals</option>
                    <option>Before bed</option>
                    <option>As needed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-sage-700 mb-1">
                    Time of Day
                  </label>
                  <select
                    value={timeOfDay}
                    onChange={(e) => setTimeOfDay(e.target.value)}
                    className="w-full rounded-lg border border-sage-200 px-4 py-2.5 text-sage-800 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                  >
                    <option>Morning</option>
                    <option>Afternoon</option>
                    <option>Evening</option>
                    <option>Morning & Evening</option>
                    <option>With each meal</option>
                  </select>
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
                  placeholder="e.g., Take on empty stomach"
                  className="w-full rounded-lg border border-sage-200 px-4 py-2.5 text-sage-800 placeholder-sage-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-green-600 py-2.5 font-medium text-white transition-colors hover:bg-green-700"
              >
                {editingId ? "Save Changes" : "Add Medication"}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-sage-400">Loading...</div>
      ) : activeMeds.length === 0 ? (
        <div className="rounded-xl border border-sage-200 bg-white p-12 text-center">
          <Pill className="mx-auto h-12 w-12 text-sage-300" strokeWidth={1} />
          <h3 className="mt-4 text-lg font-medium text-sage-700">
            No medications added yet
          </h3>
          <p className="mt-1 text-sage-500">
            Add your medications and supplements to track your doses.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeMeds.map((med) => {
            const takenToday = med.logs.some((l) => !l.skipped);
            return (
              <div
                key={med.id}
                className={`rounded-xl border bg-white p-4 transition-colors ${
                  takenToday
                    ? "border-green-200 bg-green-50/30"
                    : "border-sage-200"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg ${
                      takenToday
                        ? "bg-green-100 text-green-600"
                        : "bg-sage-100 text-sage-500"
                    }`}
                  >
                    {takenToday ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Pill className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sage-800">
                        {med.name}
                      </h3>
                      <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs text-sage-500">
                        {med.dosage}
                      </span>
                    </div>
                    <p className="text-sm text-sage-500">
                      {med.frequency}
                      {med.timeOfDay ? ` — ${med.timeOfDay}` : ""}
                    </p>
                    {med.notes && (
                      <p className="mt-1 text-sm text-sage-400">{med.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!takenToday && (
                      <>
                        <button
                          onClick={() => handleLogDose(med.id, false)}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700"
                        >
                          Taken
                        </button>
                        <button
                          onClick={() => handleLogDose(med.id, true)}
                          className="rounded-lg bg-sage-100 px-3 py-1.5 text-xs font-medium text-sage-600 transition-colors hover:bg-sage-200"
                        >
                          Skip
                        </button>
                      </>
                    )}
                    {takenToday && (
                      <span className="text-xs font-medium text-green-600">
                        Taken at{" "}
                        {new Date(med.logs[0].takenAt).toLocaleTimeString(
                          "en-US",
                          { hour: "numeric", minute: "2-digit" }
                        )}
                      </span>
                    )}
                    <button
                      onClick={() => openForm(med)}
                      className="rounded-lg p-1.5 text-sage-400 hover:bg-sage-100 hover:text-sage-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {confirmingDeleteId === med.id ? (
                      <div className="flex items-center gap-1 text-xs">
                        <button
                          onClick={() => handleDelete(med.id)}
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
                        onClick={() => setConfirmingDeleteId(med.id)}
                        className="rounded-lg p-1.5 text-sage-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
