"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.user) {
        setName(data.user.name || "");
      }
    }
    fetchUser();
  }, []);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/auth/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();
    if (res.ok) {
      setMessage({ type: "success", text: "Name updated successfully." });
    } else {
      setMessage({ type: "error", text: data.error || "Something went wrong." });
    }
    setSaving(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }

    setSaving(true);

    const res = await fetch("/api/auth/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await res.json();
    if (res.ok) {
      setMessage({ type: "success", text: "Password changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setMessage({ type: "error", text: data.error || "Something went wrong." });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-sage-900">Settings</h1>
        <p className="mt-1 text-sage-500">Manage your account</p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl p-4 text-sm font-medium animate-slide-up ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200/60"
              : "bg-red-50 text-red-700 border border-red-200/60"
          }`}
        >
          {message.type === "success" && <Check className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {/* Display Name */}
      <div className="rounded-2xl border border-sage-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-sage-800 mb-4">
          Display Name
        </h2>
        <form onSubmit={handleSaveName} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-sage-700 mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full max-w-sm rounded-xl border border-sage-200 bg-white px-4 py-3 text-sage-800 placeholder-sage-400 outline-none transition-all focus:border-green-400 focus:ring-4 focus:ring-green-100/60"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-600/20 transition-all hover:shadow-lg hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Name"}
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="rounded-2xl border border-sage-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-sage-800 mb-4">
          Change Password
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-sage-700 mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full max-w-sm rounded-xl border border-sage-200 bg-white px-4 py-3 text-sage-800 outline-none transition-all focus:border-green-400 focus:ring-4 focus:ring-green-100/60"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-sage-700 mb-1.5">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              className="w-full max-w-sm rounded-xl border border-sage-200 bg-white px-4 py-3 text-sage-800 placeholder-sage-400 outline-none transition-all focus:border-green-400 focus:ring-4 focus:ring-green-100/60"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-sage-700 mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full max-w-sm rounded-xl border border-sage-200 bg-white px-4 py-3 text-sage-800 outline-none transition-all focus:border-green-400 focus:ring-4 focus:ring-green-100/60"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-600/20 transition-all hover:shadow-lg hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
