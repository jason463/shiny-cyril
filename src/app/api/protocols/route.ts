import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET() {
  const session = await getAuthenticatedUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const protocols = await prisma.protocol.findMany({
    where: { userId: session.userId },
    include: {
      phases: { orderBy: { orderIndex: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ protocols });
}

export async function POST(request: Request) {
  const session = await getAuthenticatedUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, description, phases } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Protocol name is required" },
        { status: 400 }
      );
    }

    const protocol = await prisma.protocol.create({
      data: {
        userId: session.userId,
        name,
        description: description || null,
        phases: {
          create: (phases || []).map(
            (
              phase: { name: string; description?: string; durationDays: number },
              index: number
            ) => ({
              name: phase.name,
              description: phase.description || null,
              durationDays: phase.durationDays,
              orderIndex: index,
            })
          ),
        },
      },
      include: { phases: { orderBy: { orderIndex: "asc" } } },
    });

    return NextResponse.json({ protocol });
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
    const { id, name, description } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const protocol = await prisma.protocol.updateMany({
      where: { id, userId: session.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
      },
    });

    if (protocol.count === 0) {
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

  await prisma.protocol.deleteMany({
    where: { id, userId: session.userId },
  });

  return NextResponse.json({ success: true });
}
