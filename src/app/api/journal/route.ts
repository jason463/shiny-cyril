import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "30");
  const since = new Date();
  since.setDate(since.getDate() - days);

  const entries = await prisma.journalEntry.findMany({
    where: {
      userId: session.userId,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: "desc" },
  });

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { mealName, foods, triggers, feelingAfter, notes, timestamp } =
      await request.json();

    if (!mealName || !foods) {
      return NextResponse.json(
        { error: "Meal name and foods are required" },
        { status: 400 }
      );
    }

    const entry = await prisma.journalEntry.create({
      data: {
        userId: session.userId,
        mealName,
        foods,
        triggers: triggers || null,
        feelingAfter: feelingAfter ? parseInt(feelingAfter) : null,
        notes: notes || null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    return NextResponse.json({ entry });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  await prisma.journalEntry.deleteMany({
    where: { id, userId: session.userId },
  });

  return NextResponse.json({ success: true });
}
