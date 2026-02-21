import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const medications = await prisma.medication.findMany({
    where: { userId: session.userId },
    include: {
      logs: {
        where: {
          takenAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        orderBy: { takenAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ medications });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, dosage, frequency, timeOfDay, notes } = await request.json();

    if (!name || !dosage || !frequency) {
      return NextResponse.json(
        { error: "Name, dosage, and frequency are required" },
        { status: 400 }
      );
    }

    const medication = await prisma.medication.create({
      data: {
        userId: session.userId,
        name,
        dosage,
        frequency,
        timeOfDay: timeOfDay || null,
        notes: notes || null,
      },
    });

    return NextResponse.json({ medication });
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

  await prisma.medication.deleteMany({
    where: { id, userId: session.userId },
  });

  return NextResponse.json({ success: true });
}
