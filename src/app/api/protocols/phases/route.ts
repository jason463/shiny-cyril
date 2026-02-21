import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function PATCH(request: Request) {
  const session = await getAuthenticatedUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { phaseId, completed, startDate } = await request.json();

    if (!phaseId) {
      return NextResponse.json(
        { error: "Phase ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const phase = await prisma.protocolPhase.findFirst({
      where: { id: phaseId },
      include: { protocol: true },
    });

    if (!phase || phase.protocol.userId !== session.userId) {
      return NextResponse.json(
        { error: "Phase not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.protocolPhase.update({
      where: { id: phaseId },
      data: {
        ...(completed !== undefined && { completed }),
        ...(startDate !== undefined && {
          startDate: startDate ? new Date(startDate) : null,
        }),
      },
    });

    return NextResponse.json({ phase: updated });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
