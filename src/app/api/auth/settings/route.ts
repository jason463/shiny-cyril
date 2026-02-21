import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, hashPassword, verifyPassword } from "@/lib/auth";

export async function PATCH(request: Request) {
  const session = await getAuthenticatedUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, currentPassword, newPassword } = await request.json();

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update name
    if (name !== undefined) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { name: name || null },
      });
    }

    // Update password
    if (currentPassword && newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters" },
          { status: 400 }
        );
      }

      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      const hash = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: session.userId },
        data: { passwordHash: hash },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
