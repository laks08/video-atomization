import prisma from "../lib/db";
import { ingestTranscript } from "../lib/ingest";

async function main() {
  const videoId = process.argv[2];
  const transcriptPath = process.argv[3];

  if (!videoId || !transcriptPath) {
    throw new Error("Usage: pnpm ingest-transcript <video_id> <path_to_json>");
  }

  const count = await ingestTranscript(videoId, transcriptPath);
  console.log(`Ingested ${count} transcript segments for video ${videoId}`);
}

main()
  .catch((err) => {
    console.error("Ingest failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
