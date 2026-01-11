import { JobStatus, JobType } from "@prisma/client";
import prisma from "../lib/db";
import { detectMoments } from "../lib/detect";
import { ingestTranscript } from "../lib/ingest";
import {
  claimNextJob,
  hasSuccessfulJob,
  markJobFailed,
  markJobSucceeded,
  requeueJob,
} from "../lib/jobs";
import { renderClips } from "../lib/render";

const POLL_INTERVAL_MS = 1000;
const DEPENDENCY_DELAY_MS = 15_000;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleJob(job: Awaited<ReturnType<typeof claimNextJob>>) {
  if (!job) {
    return false;
  }

  if (job.type === JobType.DETECT_MOMENTS) {
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
        return true;
      }
    }
  }

  if (job.type === JobType.DETECT_MOMENTS) {
    const ready = await hasSuccessfulJob(job.video_id, JobType.INGEST_TRANSCRIPT);
    if (!ready) {
      await requeueJob(
        job.id,
        new Date(Date.now() + DEPENDENCY_DELAY_MS),
        true
      );
      return true;
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
      return true;
    }
  }

  try {
    if (job.type === JobType.INGEST_TRANSCRIPT) {
      const payload = job.payload as { transcriptPath?: string } | null;
      const transcriptPath = payload?.transcriptPath;
      if (!transcriptPath) {
        throw new Error("INGEST_TRANSCRIPT missing payload.transcriptPath");
      }

      await ingestTranscript(job.video_id, transcriptPath);
    } else if (job.type === JobType.DETECT_MOMENTS) {
      await detectMoments(job.video_id);
    } else if (job.type === JobType.RENDER_CLIPS) {
      const result = await renderClips(job.video_id);
      if (result.hadFailures) {
        throw new Error("One or more clips failed to render");
      }
    }

    await markJobSucceeded(job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = await markJobFailed(
      job.id,
      message,
      job.max_attempts,
      job.attempts
    );
    console.error(`[worker] ${job.type} failed (${status}):`, message);
  }

  return true;
}

async function main() {
  console.log("[worker] started");
  while (true) {
    const job = await claimNextJob();
    const handled = await handleJob(job);
    if (!handled) {
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

main().catch((err) => {
  console.error("[worker] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
