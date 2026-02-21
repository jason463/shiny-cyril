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
    <div className="flex min-h-screen items-center justify-center bg-sage-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-base font-bold text-white">
              MG
            </div>
            <span className="text-xl font-bold text-sage-800">MyGutPal</span>
          </Link>
        </div>

        <div className="rounded-xl border border-sage-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-sage-900 mb-1">Welcome back</h1>
          <p className="text-sage-500 mb-6">Sign in to your account</p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-sage-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-sage-200 px-4 py-2.5 text-sage-800 placeholder-sage-400 outline-none transition-colors focus:border-green-400 focus:ring-2 focus:ring-green-100"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-sage-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-sage-200 px-4 py-2.5 text-sage-800 placeholder-sage-400 outline-none transition-colors focus:border-green-400 focus:ring-2 focus:ring-green-100"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-600 py-2.5 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-sage-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-green-600 hover:text-green-700">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
