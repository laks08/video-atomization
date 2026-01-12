import { NextResponse } from "next/server";
import { JobType } from "@prisma/client";
import prisma from "../../../../../lib/db";
import { enqueueJob } from "../../../../../lib/jobs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const videoId = params.id;
  const body = await request.json().catch(() => null);
  const transcriptUrl = body?.transcriptUrl;

  if (!transcriptUrl || typeof transcriptUrl !== "string") {
    return NextResponse.json(
      { error: "Missing transcriptUrl" },
      { status: 400 }
    );
  }

  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) {
    return NextResponse.json(
      { error: "Video not found" },
      { status: 404 }
    );
  }
  if (video.source_path === "pending") {
    return NextResponse.json(
      { error: "Video upload not finished yet" },
      { status: 400 }
    );
  }

  const jobs = [];
  jobs.push(
    await enqueueJob(videoId, JobType.INGEST_TRANSCRIPT, { transcriptUrl })
  );
  jobs.push(await enqueueJob(videoId, JobType.DETECT_MOMENTS));
  jobs.push(await enqueueJob(videoId, JobType.RENDER_CLIPS));

  const origin = request.headers.get("origin");
  if (origin) {
    const workerUrl = new URL("/api/worker/run", origin);
    void fetch(workerUrl, { method: "POST" }).catch(() => undefined);
  }

  return NextResponse.json({ jobs });
}
