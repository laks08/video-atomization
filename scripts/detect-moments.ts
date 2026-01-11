import prisma from "../lib/db";
import { detectMoments } from "../lib/detect";

async function main() {
  const videoId = process.argv[2];
  if (!videoId) {
    throw new Error("Usage: pnpm detect-moments <video_id>");
  }

  const count = await detectMoments(videoId);
  console.log(`Inserted ${count} moments for video ${videoId}`);
}

main()
  .catch((err) => {
    console.error(
      "Detect moments failed:",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
