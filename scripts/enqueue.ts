import { JobType } from "@prisma/client";
import prisma from "../lib/db";
import { enqueueJob } from "../lib/jobs";

async function main() {
  const videoId = process.argv[2];
  const transcriptFlagIndex = process.argv.indexOf("--transcript");
  const transcriptPath =
    transcriptFlagIndex !== -1 ? process.argv[transcriptFlagIndex + 1] : undefined;

  if (!videoId || !transcriptPath) {
    throw new Error(
      "Usage: pnpm enqueue <video_id> --transcript <path_to_json>"
    );
  }

  const jobs = [];
  jobs.push(
    await enqueueJob(videoId, JobType.INGEST_TRANSCRIPT, {
      transcriptPath,
    })
  );
  jobs.push(await enqueueJob(videoId, JobType.DETECT_MOMENTS));
  jobs.push(await enqueueJob(videoId, JobType.RENDER_CLIPS));

  for (const job of jobs) {
    console.log(`${job.id} ${job.type} ${job.status}`);
  }
}

main()
  .catch((err) => {
    console.error("Enqueue failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
