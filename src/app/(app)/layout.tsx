import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Sidebar from "@/components/app/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-sage-50">
      <Sidebar userName={user.name || user.email} />
      <main className="pt-14 lg:pt-0 lg:pl-60">
        <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
