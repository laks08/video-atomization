import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import prisma from "./db";
import { extractClip, makeVertical } from "./ffmpeg";

export type RenderResult = {
  hadFailures: boolean;
  renderedCount: number;
};

export async function renderClips(videoId: string): Promise<RenderResult> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { moments: { orderBy: { rank: "asc" } } },
  });

  if (!video) {
    throw new Error(`Video not found: ${videoId}`);
  }

  const inputPath = path.resolve(video.source_path);
  try {
    await access(inputPath);
  } catch {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  if (video.moments.length === 0) {
    return { hadFailures: false, renderedCount: 0 };
  }

  const outputDirRel = path.join("./outputs", videoId);
  const outputDir = path.resolve(outputDirRel);
  await mkdir(outputDir, { recursive: true });

  await prisma.clipAsset.deleteMany({ where: { video_id: videoId } });

  let hadFailures = false;
  let renderedCount = 0;

  for (const moment of video.moments) {
    const horizontalRel = path.join(
      outputDirRel,
      `${moment.rank}_horizontal.mp4`
    );
    const verticalRel = path.join(
      outputDirRel,
      `${moment.rank}_vertical.mp4`
    );
    const horizontalPath = path.resolve(horizontalRel);
    const verticalPath = path.resolve(verticalRel);

    try {
      await extractClip(
        inputPath,
        moment.start_ms,
        moment.end_ms,
        horizontalPath
      );

      await prisma.clipAsset.create({
        data: {
          video_id: video.id,
          moment_id: moment.id,
          orientation: "horizontal",
          file_path: horizontalRel,
          start_ms: moment.start_ms,
          end_ms: moment.end_ms,
        },
      });
    } catch (err) {
      hadFailures = true;
      console.error(
        `[render] moment ${moment.rank}: failed to create horizontal clip:`,
        err instanceof Error ? err.message : err
      );
      continue;
    }

    try {
      await makeVertical(horizontalPath, verticalPath);

      await prisma.clipAsset.create({
        data: {
          video_id: video.id,
          moment_id: moment.id,
          orientation: "vertical",
          file_path: verticalRel,
          start_ms: moment.start_ms,
          end_ms: moment.end_ms,
        },
      });

      renderedCount += 1;
    } catch (err) {
      hadFailures = true;
      console.error(
        `[render] moment ${moment.rank}: failed to create vertical clip:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return { hadFailures, renderedCount };
}
