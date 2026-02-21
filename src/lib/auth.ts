import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "mygutpal-dev-secret-change-in-production"
);

const COOKIE_NAME = "mygutpal-session";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(
  userId: string,
  email?: string,
  name?: string | null,
  passwordHash?: string
): Promise<string> {
  const token = await new SignJWT({
    userId,
    email,
    name: name || null,
    ph: passwordHash || null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return token;
}

interface SessionData {
  userId: string;
  email?: string;
  name?: string | null;
  passwordHash?: string | null;
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string | undefined,
      name: (payload.name as string | null) || null,
      passwordHash: (payload.ph as string | null) || null,
    };
  } catch {
    return null;
  }
}

/**
 * Ensures the user from the JWT exists in this container's database.
 * On Vercel, each serverless container has its own ephemeral SQLite,
 * so we re-create the user record from JWT claims when needed.
 */
export async function ensureUserInDb(session: SessionData) {
  if (!session.email) return null;

  try {
    const existing = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true },
    });
    if (existing) return existing;
  } catch {
    // DB lookup failed
  }

  try {
    const user = await prisma.user.create({
      data: {
        id: session.userId,
        email: session.email,
        name: session.name || null,
        passwordHash: session.passwordHash || "jwt-synced",
        updatedAt: new Date(),
      },
      select: { id: true, email: true, name: true },
    });
    return user;
  } catch {
    // Creation failed (maybe race condition), return JWT claims
    return { id: session.userId, email: session.email, name: session.name || null };
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  const user = await ensureUserInDb(session);
  if (user) return user;

  return null;
}

/**
 * Gets the authenticated session and ensures the user exists in the
 * local DB. Use this in API routes that write data (for FK constraints).
 */
export async function getAuthenticatedUser() {
  const session = await getSession();
  if (!session) return null;
  await ensureUserInDb(session);
  return session;
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
