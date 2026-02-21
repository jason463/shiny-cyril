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
  Settings,
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
      <div className="p-5 border-b border-sage-100">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-sm font-bold text-white shadow-md shadow-green-600/20">
            MG
          </div>
          <span className="text-lg font-bold text-sage-800">MyGutPal</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 shadow-sm"
                  : "text-sage-500 hover:bg-sage-50 hover:text-sage-700"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-green-500 to-emerald-500" />
              )}
              <item.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sage-100 p-3">
        {userName && (
          <div className="px-3 mb-3 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sage-200 to-sage-300 text-xs font-bold text-sage-600">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium text-sage-500 truncate">{userName}</span>
          </div>
        )}
        <Link
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
            pathname === "/settings"
              ? "bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 shadow-sm"
              : "text-sage-500 hover:bg-sage-50 hover:text-sage-700"
          }`}
        >
          {pathname === "/settings" && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-green-500 to-emerald-500" />
          )}
          <Settings className="h-[18px] w-[18px]" strokeWidth={pathname === "/settings" ? 2 : 1.5} />
          Settings
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sage-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-sage-100 bg-white/80 backdrop-blur-xl px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-xs font-bold text-white shadow-sm">
            MG
          </div>
          <span className="text-base font-bold text-sage-800">MyGutPal</span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-xl p-2 text-sage-500 hover:bg-sage-50 transition-colors"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed left-0 top-14 bottom-0 z-30 w-72 bg-white border-r border-sage-100 flex flex-col transition-transform duration-300 ease-out lg:hidden shadow-xl ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 shadow-sm"
                    : "text-sage-500 hover:bg-sage-50 hover:text-sage-700"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-green-500 to-emerald-500" />
                )}
                <item.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2 : 1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sage-100 p-3">
          <Link
            href="/settings"
            onClick={() => setMobileOpen(false)}
            className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              pathname === "/settings"
                ? "bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 shadow-sm"
                : "text-sage-500 hover:bg-sage-50 hover:text-sage-700"
            }`}
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={pathname === "/settings" ? 2 : 1.5} />
            Settings
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sage-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.5} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 flex-col border-r border-sage-100 bg-white/80 backdrop-blur-xl">
        {navContent}
      </aside>
    </>
  );
}
