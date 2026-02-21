import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession, getSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Try DB lookup first
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: "Invalid email or password" },
          { status: 401 }
        );
      }

      await createSession(user.id, user.email, user.name, user.passwordHash);

      return NextResponse.json({
        user: { id: user.id, email: user.email, name: user.name },
      });
    }

    // User not in this container's DB — check if an existing JWT session
    // has the password hash (handles Vercel cross-container scenario)
    const existingSession = await getSession();
    if (existingSession && existingSession.email === normalizedEmail && existingSession.passwordHash) {
      const valid = await verifyPassword(password, existingSession.passwordHash);
      if (valid) {
        await createSession(
          existingSession.userId,
          existingSession.email,
          existingSession.name,
          existingSession.passwordHash
        );
        return NextResponse.json({
          user: {
            id: existingSession.userId,
            email: existingSession.email,
            name: existingSession.name,
          },
        });
      }
    }

    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
