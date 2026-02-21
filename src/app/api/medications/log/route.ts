import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getAuthenticatedUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { medicationId, skipped } = await request.json();

    if (!medicationId) {
      return NextResponse.json(
        { error: "Medication ID is required" },
        { status: 400 }
      );
    }

    // Verify the medication belongs to this user
    const med = await prisma.medication.findFirst({
      where: { id: medicationId, userId: session.userId },
    });

    if (!med) {
      return NextResponse.json(
        { error: "Medication not found" },
        { status: 404 }
      );
    }

    const log = await prisma.medicationLog.create({
      data: {
        medicationId,
        skipped: skipped || false,
      },
    });

    return NextResponse.json({ log });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
