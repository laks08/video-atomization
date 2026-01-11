import prisma from "../lib/db";

async function main() {
  const video = await prisma.video.create({
    data: {
      source_path: "./samples/input.mp4",
      original_filename: "input.mp4",
      moments: {
        create: [
          {
            rank: 1,
            start_ms: 60_000,
            end_ms: 90_000,
            title: "Moment 1",
          },
          {
            rank: 2,
            start_ms: 120_000,
            end_ms: 150_000,
            title: "Moment 2",
          },
          {
            rank: 3,
            start_ms: 180_000,
            end_ms: 210_000,
            title: "Moment 3",
          },
        ],
      },
    },
  });

  console.log("Created video:", video.id);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
