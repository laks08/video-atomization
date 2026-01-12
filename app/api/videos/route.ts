import { NextResponse } from "next/server";
import prisma from "../../../lib/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const filename = body?.filename;

  if (!filename || typeof filename !== "string") {
    return NextResponse.json(
      { error: "Missing filename" },
      { status: 400 }
    );
  }

  const video = await prisma.video.create({
    data: {
      source_path: "pending",
      original_filename: filename,
    },
  });

  return NextResponse.json({ id: video.id });
}
