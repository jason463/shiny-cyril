import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getAuthenticatedUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "30");
  const since = new Date();
  since.setDate(since.getDate() - days);

  const symptoms = await prisma.symptom.findMany({
    where: {
      userId: session.userId,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: "desc" },
  });

  return NextResponse.json({ symptoms });
}

export async function POST(request: Request) {
  const session = await getAuthenticatedUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, severity, notes, timestamp } = await request.json();

    if (!name || !severity) {
      return NextResponse.json(
        { error: "Name and severity are required" },
        { status: 400 }
      );
    }

    const symptom = await prisma.symptom.create({
      data: {
        userId: session.userId,
        name,
        severity: Math.min(10, Math.max(1, parseInt(severity))),
        notes: notes || null,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    return NextResponse.json({ symptom });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getAuthenticatedUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, name, severity, notes } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const symptom = await prisma.symptom.updateMany({
      where: { id, userId: session.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(severity !== undefined && {
          severity: Math.min(10, Math.max(1, parseInt(severity))),
        }),
        ...(notes !== undefined && { notes: notes || null }),
      },
    });

    if (symptom.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getAuthenticatedUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  await prisma.symptom.deleteMany({
    where: { id, userId: session.userId },
  });

  return NextResponse.json({ success: true });
}
