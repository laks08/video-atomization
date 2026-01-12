import { NextResponse } from "next/server";
import { JobType } from "@prisma/client";
import prisma from "../../../../lib/db";
import { detectMoments } from "../../../../lib/detect";
import { ingestTranscript } from "../../../../lib/ingest";
import {
  claimNextJob,
  hasSuccessfulJob,
  markJobFailed,
  markJobSucceeded,
  requeueJob,
} from "../../../../lib/jobs";
import { renderClips } from "../../../../lib/render";

const DEPENDENCY_DELAY_MS = 15_000;

export const runtime = "nodejs";

async function runJob(job: Awaited<ReturnType<typeof claimNextJob>>) {
  if (!job) {
    return { status: "idle" as const };
  }

  if (job.type === JobType.DETECT_MOMENTS) {
    const ready = await hasSuccessfulJob(job.video_id, JobType.INGEST_TRANSCRIPT);
    if (!ready) {
      await requeueJob(
        job.id,
        new Date(Date.now() + DEPENDENCY_DELAY_MS),
        true
      );
      return { status: "deferred" as const, jobId: job.id };
    }

    const alreadySucceeded = await hasSuccessfulJob(
      job.video_id,
      JobType.DETECT_MOMENTS
    );
    if (alreadySucceeded) {
      const momentsCount = await prisma.moment.count({
        where: { video_id: job.video_id },
      });
      if (momentsCount > 0) {
        await markJobSucceeded(job.id);
        return { status: "skipped" as const, jobId: job.id };
      }
    }
  }

  if (job.type === JobType.RENDER_CLIPS) {
    const ready = await hasSuccessfulJob(job.video_id, JobType.DETECT_MOMENTS);
    if (!ready) {
      await requeueJob(
        job.id,
        new Date(Date.now() + DEPENDENCY_DELAY_MS),
        true
      );
      return { status: "deferred" as const, jobId: job.id };
    }
  }

  try {
    if (job.type === JobType.INGEST_TRANSCRIPT) {
      const payload = job.payload as
        | { transcriptPath?: string; transcriptUrl?: string }
        | null;
      const transcriptSource =
        payload?.transcriptUrl ?? payload?.transcriptPath;
      if (!transcriptSource) {
        throw new Error(
          "INGEST_TRANSCRIPT missing payload.transcriptPath or transcriptUrl"
        );
      }

      await ingestTranscript(job.video_id, transcriptSource);
    } else if (job.type === JobType.DETECT_MOMENTS) {
      await detectMoments(job.video_id);
    } else if (job.type === JobType.RENDER_CLIPS) {
      const result = await renderClips(job.video_id);
      if (result.hadFailures) {
        throw new Error("One or more clips failed to render");
      }
    }

    await markJobSucceeded(job.id);
    return { status: "succeeded" as const, jobId: job.id, videoId: job.video_id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = await markJobFailed(
      job.id,
      message,
      job.max_attempts,
      job.attempts
    );
    return { status, jobId: job.id, error: message };
  }
}

export async function POST() {
  const results: Array<Record<string, unknown>> = [];
  let lastVideoId: string | null = null;

  for (let i = 0; i < 3; i += 1) {
    const job = await claimNextJob();
    if (!job) {
      break;
    }

    if (lastVideoId && job.video_id !== lastVideoId) {
      await requeueJob(job.id, new Date(), true);
      break;
    }

    const result = await runJob(job);
    results.push(result);

    if (result.status !== "succeeded" && result.status !== "skipped") {
      break;
    }

    lastVideoId = job.video_id;
  }

  if (results.length === 0) {
    return NextResponse.json({ status: "idle" });
  }

  return NextResponse.json({ status: "processed", results });
}
