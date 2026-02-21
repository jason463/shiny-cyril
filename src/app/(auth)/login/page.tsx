"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-sage-50 via-white to-green-50 px-4">
      <div className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-green-100/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-sage-100/50 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-base font-bold text-white shadow-lg shadow-green-600/20">
              MG
            </div>
            <span className="text-xl font-bold text-sage-800">MyGutPal</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-sage-200/60 bg-white/80 p-8 shadow-xl shadow-sage-200/30 backdrop-blur-sm">
          <h1 className="text-2xl font-bold text-sage-900 mb-1">Welcome back</h1>
          <p className="text-sage-500 mb-6">Sign in to your account</p>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200/60 px-4 py-3 text-sm text-red-600 animate-slide-up">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-sage-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-sage-200 bg-white px-4 py-3 text-sage-800 placeholder-sage-400 outline-none transition-all focus:border-green-400 focus:ring-4 focus:ring-green-100/60"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-sage-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-sage-200 bg-white px-4 py-3 text-sage-800 placeholder-sage-400 outline-none transition-all focus:border-green-400 focus:ring-4 focus:ring-green-100/60"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 py-3 font-semibold text-white shadow-md shadow-green-600/20 transition-all hover:shadow-lg hover:brightness-110 disabled:opacity-60 disabled:hover:shadow-md"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-sage-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-green-600 hover:text-green-700 transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
