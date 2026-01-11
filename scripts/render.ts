import prisma from "../lib/db";
import { renderClips } from "../lib/render";

async function main() {
  const videoId = process.argv[2];
  if (!videoId) {
    throw new Error("Usage: pnpm render <video_id>");
  }

  const result = await renderClips(videoId);

  if (result.renderedCount === 0) {
    console.log("No moments found for video:", videoId);
  }

  if (result.hadFailures) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("[render] failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
