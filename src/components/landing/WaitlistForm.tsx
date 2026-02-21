"use client";

import { useState } from "react";

export default function WaitlistForm({ variant = "default" }: { variant?: "default" | "large" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage("You're on the list! We'll be in touch soon.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  const isLarge = variant === "large";

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className={`flex ${isLarge ? "flex-col sm:flex-row" : "flex-row"} gap-3`}>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          required
          className={`flex-1 rounded-lg border border-sage-200 bg-white px-4 ${
            isLarge ? "py-3.5 text-base" : "py-3 text-sm"
          } text-sage-800 placeholder-sage-400 outline-none transition-colors focus:border-green-400 focus:ring-2 focus:ring-green-100`}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className={`rounded-lg bg-green-600 font-medium text-white transition-all hover:bg-green-700 active:scale-[0.98] disabled:opacity-60 ${
            isLarge ? "px-8 py-3.5 text-base" : "px-6 py-3 text-sm"
          }`}
        >
          {status === "loading" ? "Joining..." : "Join Waitlist"}
        </button>
      </div>
      {status !== "idle" && (
        <p
          className={`mt-2 text-sm ${
            status === "success" ? "text-green-600" : "text-red-500"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
