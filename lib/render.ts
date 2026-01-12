import { access, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import prisma from "./db";
import { extractClip, makeVertical } from "./ffmpeg";
import {
  cleanupTempFile,
  downloadToTempFile,
  isRemoteUrl,
  uploadFileToBlob,
} from "./blob";

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

  let inputPath = video.source_path;
  if (isRemoteUrl(video.source_path)) {
    inputPath = await downloadToTempFile(
      video.source_path,
      `${video.id}-source.mp4`
    );
  } else {
    inputPath = path.resolve(video.source_path);
    try {
      await access(inputPath);
    } catch {
      throw new Error(`Input file not found: ${inputPath}`);
    }
  }

  if (video.moments.length === 0) {
    return { hadFailures: false, renderedCount: 0 };
  }

  await prisma.clipAsset.deleteMany({ where: { video_id: videoId } });

  let hadFailures = false;
  let renderedCount = 0;
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), `video-atomization-${videoId}-`)
  );

  for (const moment of video.moments) {
    const horizontalPath = path.join(
      tempDir,
      `${moment.rank}_horizontal.mp4`
    );
    const verticalPath = path.join(
      tempDir,
      `${moment.rank}_vertical.mp4`
    );

    try {
      await extractClip(
        inputPath,
        moment.start_ms,
        moment.end_ms,
        horizontalPath
      );

      const horizontalUrl = await uploadFileToBlob(
        horizontalPath,
        `clips/${video.id}/${moment.rank}_horizontal.mp4`
      );

      await prisma.clipAsset.create({
        data: {
          video_id: video.id,
          moment_id: moment.id,
          orientation: "horizontal",
          file_path: horizontalUrl,
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

      const verticalUrl = await uploadFileToBlob(
        verticalPath,
        `clips/${video.id}/${moment.rank}_vertical.mp4`
      );

      await prisma.clipAsset.create({
        data: {
          video_id: video.id,
          moment_id: moment.id,
          orientation: "vertical",
          file_path: verticalUrl,
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

  if (isRemoteUrl(video.source_path)) {
    await cleanupTempFile(inputPath);
  }
  await rm(tempDir, { recursive: true, force: true });

  return { hadFailures, renderedCount };
}
