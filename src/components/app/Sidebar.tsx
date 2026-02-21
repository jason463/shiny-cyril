"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Pill,
  Timer,
  CalendarDays,
  UtensilsCrossed,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/symptoms", label: "Symptoms", icon: Activity },
  { href: "/medications", label: "Medications", icon: Pill },
  { href: "/timer", label: "Meal Timer", icon: Timer },
  { href: "/protocols", label: "Protocols", icon: CalendarDays },
  { href: "/journal", label: "Food Journal", icon: UtensilsCrossed },
  { href: "/progress", label: "Progress", icon: BarChart3 },
];

export default function Sidebar({ userName }: { userName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const navContent = (
    <>
      <div className="p-4 border-b border-sage-200">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-sm font-bold text-white">
            MG
          </div>
          <span className="text-lg font-bold text-sage-800">MyGutPal</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-green-50 text-green-700"
                  : "text-sage-600 hover:bg-sage-100 hover:text-sage-800"
              }`}
            >
              <item.icon className="h-5 w-5" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sage-200 p-3">
        {userName && (
          <p className="px-3 mb-2 text-xs text-sage-400 truncate">{userName}</p>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sage-600 transition-colors hover:bg-sage-100 hover:text-sage-800"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.5} />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-sage-200 bg-white px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-600 text-xs font-bold text-white">
            MG
          </div>
          <span className="text-base font-bold text-sage-800">MyGutPal</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-sage-600 hover:bg-sage-100"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed left-0 top-14 bottom-0 z-30 w-64 bg-white border-r border-sage-200 flex flex-col transition-transform duration-200 lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-green-50 text-green-700"
                    : "text-sage-600 hover:bg-sage-100 hover:text-sage-800"
                }`}
              >
                <item.icon className="h-5 w-5" strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sage-200 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sage-600 transition-colors hover:bg-sage-100 hover:text-sage-800"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.5} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 flex-col border-r border-sage-200 bg-white">
        {navContent}
      </aside>
    </>
  );
}
