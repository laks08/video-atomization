import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import prisma from "../../../lib/db";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file" },
      { status: 400 }
    );
  }

  const apiToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!apiToken) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN is not set" },
      { status: 500 }
    );
  }

  const video = await prisma.video.create({
    data: {
      source_path: "pending",
      original_filename: file.name,
    },
  });

  try {
    const blob = await put(
      `videos/${video.id}/${file.name}`,
      file,
      {
        access: "public",
        token: apiToken,
        contentType: file.type || "video/mp4",
      }
    );

    const updated = await prisma.video.update({
      where: { id: video.id },
      data: { source_path: blob.url },
    });

    return NextResponse.json({
      id: updated.id,
      source_url: updated.source_path,
    });
  } catch (err) {
    await prisma.video.delete({ where: { id: video.id } });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
