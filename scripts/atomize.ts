import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { extractClip, makeVertical } from "../lib/ffmpeg";

const input = "./samples/input.mp4";
const startMs = 60_000;
const endMs = 90_000;

async function main() {
  const inputPath = path.resolve(input);
  const outputsDir = path.resolve("./outputs");
  const horizontalPath = path.join(outputsDir, "clip_horizontal.mp4");
  const verticalPath = path.join(outputsDir, "clip_vertical.mp4");

  try {
    await access(inputPath);
  } catch {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  await mkdir(outputsDir, { recursive: true });

  console.log("[atomize] extracting horizontal clip...");
  await extractClip(inputPath, startMs, endMs, horizontalPath);

  console.log("[atomize] creating vertical clip...");
  await makeVertical(horizontalPath, verticalPath);

  console.log("[atomize] done");
}

main().catch((err) => {
  console.error("[atomize] failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
