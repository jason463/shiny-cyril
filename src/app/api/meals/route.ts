import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meals = await prisma.mealLog.findMany({
    where: { userId: session.userId },
    orderBy: { mealTime: "desc" },
    take: 50,
  });

  return NextResponse.json({ meals });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { notes, mealTime } = await request.json();

    const meal = await prisma.mealLog.create({
      data: {
        userId: session.userId,
        mealTime: mealTime ? new Date(mealTime) : new Date(),
        notes: notes || null,
      },
    });

    return NextResponse.json({ meal });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
