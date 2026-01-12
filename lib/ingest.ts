import { readFile } from "node:fs/promises";
import path from "node:path";
import prisma from "./db";
import { normalizeTranscript } from "./transcript";
import { isRemoteUrl } from "./blob";

export async function ingestTranscript(
  videoId: string,
  transcriptPath: string
): Promise<number> {
  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) {
    throw new Error(`Video not found: ${videoId}`);
  }

  let parsed: unknown;
  if (isRemoteUrl(transcriptPath)) {
    const res = await fetch(transcriptPath);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch transcript: ${res.status} ${res.statusText}`
      );
    }
    parsed = await res.json();
  } else {
    const resolvedPath = path.resolve(transcriptPath);
    const raw = await readFile(resolvedPath, "utf8");
    parsed = JSON.parse(raw);
  }
  const segments = normalizeTranscript(parsed);

  await prisma.transcriptSegment.deleteMany({ where: { video_id: videoId } });

  await prisma.transcriptSegment.createMany({
    data: segments.map((segment) => ({
      video_id: videoId,
      start_ms: segment.start_ms,
      end_ms: segment.end_ms,
      text: segment.text,
    })),
  });

  return segments.length;
}
