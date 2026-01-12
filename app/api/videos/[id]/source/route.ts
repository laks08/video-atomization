import { NextResponse } from "next/server";
import prisma from "../../../../../lib/db";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const videoId = params.id;
  const body = await request.json().catch(() => null);
  const sourceUrl = body?.sourceUrl;

  if (!sourceUrl || typeof sourceUrl !== "string") {
    return NextResponse.json(
      { error: "Missing sourceUrl" },
      { status: 400 }
    );
  }

  const updated = await prisma.video.update({
    where: { id: videoId },
    data: { source_path: sourceUrl },
  });

  return NextResponse.json({ id: updated.id, source_path: updated.source_path });
}
