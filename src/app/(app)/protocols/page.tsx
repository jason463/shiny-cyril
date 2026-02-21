"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarDays, Plus, X, Trash2, Check, ChevronDown, ChevronUp, Pencil } from "lucide-react";

interface Phase {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  orderIndex: number;
  completed: boolean;
  startDate: string | null;
}

interface Protocol {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  startDate: string;
  phases: Phase[];
}

export default function ProtocolsPage() {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phases, setPhases] = useState([
    { name: "", description: "", durationDays: 14 },
  ]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchProtocols = useCallback(async () => {
    const res = await fetch("/api/protocols");
    const data = await res.json();
    if (data.protocols) setProtocols(data.protocols);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProtocols();
  }, [fetchProtocols]);

  function openForm(protocol?: Protocol) {
    if (protocol) {
      setEditingId(protocol.id);
      setName(protocol.name);
      setDescription(protocol.description || "");
    } else {
      setEditingId(null);
      setName("");
      setDescription("");
      setPhases([{ name: "", description: "", durationDays: 14 }]);
    }
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;

    if (editingId) {
      await fetch("/api/protocols", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, name, description }),
      });
    } else {
      if (phases.some((p) => !p.name)) return;
      await fetch("/api/protocols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, phases }),
      });
    }

    setShowForm(false);
    setEditingId(null);
    setName("");
    setDescription("");
    setPhases([{ name: "", description: "", durationDays: 14 }]);
    fetchProtocols();
  }

  async function togglePhase(phaseId: string, completed: boolean) {
    await fetch("/api/protocols/phases", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phaseId,
        completed,
        startDate: completed ? null : new Date().toISOString(),
      }),
    });
    fetchProtocols();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/protocols?id=${id}`, { method: "DELETE" });
    setConfirmingDeleteId(null);
    fetchProtocols();
  }

  function addPhase() {
    setPhases([...phases, { name: "", description: "", durationDays: 14 }]);
  }

  function removePhase(index: number) {
    if (phases.length <= 1) return;
    setPhases(phases.filter((_, i) => i !== index));
  }

  function updatePhase(
    index: number,
    field: string,
    value: string | number
  ) {
    const updated = [...phases];
    updated[index] = { ...updated[index], [field]: value };
    setPhases(updated);
  }

  function getProtocolProgress(protocol: Protocol) {
    const totalDays = protocol.phases.reduce(
      (sum, p) => sum + p.durationDays,
      0
    );
    const completedDays = protocol.phases
      .filter((p) => p.completed)
      .reduce((sum, p) => sum + p.durationDays, 0);
    return totalDays > 0 ? (completedDays / totalDays) * 100 : 0;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-sage-900">
            Protocol Timeline
          </h1>
          <p className="mt-1 text-sage-500">
            Create and track multi-phase treatment protocols
          </p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          New Protocol
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-20">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-sage-900">
                {editingId ? "Edit Protocol" : "New Protocol"}
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
                  Protocol Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='e.g., "SIBO Treatment Round 2"'
                  required
                  className="w-full rounded-lg border border-sage-200 px-4 py-2.5 text-sage-800 placeholder-sage-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-sage-700 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief overview of this protocol"
                  className="w-full rounded-lg border border-sage-200 px-4 py-2.5 text-sage-800 placeholder-sage-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                />
              </div>

              {!editingId && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-sage-700">
                      Phases
                    </label>
                    <button
                      type="button"
                      onClick={addPhase}
                      className="text-sm text-green-600 hover:text-green-700 font-medium"
                    >
                      + Add phase
                    </button>
                  </div>
                  <div className="space-y-3">
                    {phases.map((phase, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-sage-200 bg-sage-50 p-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            value={phase.name}
                            onChange={(e) =>
                              updatePhase(index, "name", e.target.value)
                            }
                            placeholder="Phase name"
                            required
                            className="flex-1 rounded-lg border border-sage-200 bg-white px-3 py-1.5 text-sm text-sage-800 placeholder-sage-400 outline-none focus:border-green-400"
                          />
                          {phases.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePhase(index)}
                              className="text-sage-400 hover:text-red-500"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={phase.description}
                            onChange={(e) =>
                              updatePhase(index, "description", e.target.value)
                            }
                            placeholder="Description (optional)"
                            className="flex-1 rounded-lg border border-sage-200 bg-white px-3 py-1.5 text-sm text-sage-800 placeholder-sage-400 outline-none focus:border-green-400"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={phase.durationDays}
                              onChange={(e) =>
                                updatePhase(
                                  index,
                                  "durationDays",
                                  parseInt(e.target.value) || 1
                                )
                              }
                              min="1"
                              className="w-16 rounded-lg border border-sage-200 bg-white px-2 py-1.5 text-center text-sm text-sage-800 outline-none focus:border-green-400"
                            />
                            <span className="text-xs text-sage-500">days</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-lg bg-green-600 py-2.5 font-medium text-white transition-colors hover:bg-green-700"
              >
                {editingId ? "Save Changes" : "Create Protocol"}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-sage-400">Loading...</div>
      ) : protocols.length === 0 ? (
        <div className="rounded-xl border border-sage-200 bg-white p-12 text-center">
          <CalendarDays
            className="mx-auto h-12 w-12 text-sage-300"
            strokeWidth={1}
          />
          <h3 className="mt-4 text-lg font-medium text-sage-700">
            No protocols yet
          </h3>
          <p className="mt-1 text-sage-500">
            Create a treatment protocol to track your progress through each
            phase.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {protocols.map((protocol) => {
            const progress = getProtocolProgress(protocol);
            const isExpanded = expandedId === protocol.id;
            return (
              <div
                key={protocol.id}
                className="rounded-xl border border-sage-200 bg-white overflow-hidden"
              >
                <div
                  className="flex items-center gap-4 p-5 cursor-pointer"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : protocol.id)
                  }
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sage-800">
                      {protocol.name}
                    </h3>
                    {protocol.description && (
                      <p className="text-sm text-sage-500 mt-0.5">
                        {protocol.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-sage-100">
                        <div
                          className="h-2 rounded-full bg-green-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-sage-600">
                        {Math.round(progress)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openForm(protocol);
                      }}
                      className="rounded-lg p-1.5 text-sage-400 hover:bg-sage-100 hover:text-sage-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {confirmingDeleteId === protocol.id ? (
                      <div
                        className="flex items-center gap-1 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleDelete(protocol.id)}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingDeleteId(protocol.id);
                        }}
                        className="rounded-lg p-1.5 text-sage-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-sage-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-sage-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-sage-200 p-5">
                    <div className="space-y-3">
                      {protocol.phases.map((phase, index) => (
                        <div
                          key={phase.id}
                          className={`flex items-start gap-3 rounded-lg p-3 ${
                            phase.completed
                              ? "bg-green-50"
                              : "bg-sage-50"
                          }`}
                        >
                          <button
                            onClick={() =>
                              togglePhase(phase.id, !phase.completed)
                            }
                            className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                              phase.completed
                                ? "border-green-500 bg-green-500 text-white"
                                : "border-sage-300 hover:border-green-400"
                            }`}
                          >
                            {phase.completed && (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-sage-400">
                                Phase {index + 1}
                              </span>
                              <span className="rounded-full bg-sage-200 px-2 py-0.5 text-xs text-sage-600">
                                {phase.durationDays} days
                              </span>
                            </div>
                            <p
                              className={`font-medium ${
                                phase.completed
                                  ? "text-green-700 line-through"
                                  : "text-sage-800"
                              }`}
                            >
                              {phase.name}
                            </p>
                            {phase.description && (
                              <p className="text-sm text-sage-500">
                                {phase.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
