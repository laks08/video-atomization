import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";

export function msToTimestamp(ms: number): string {
  const totalMs = Math.max(0, Math.floor(ms));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1_000);
  const millis = totalMs % 1_000;

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const pad3 = (n: number) => String(n).padStart(3, "0");

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}

export function runCmd(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

export async function extractClip(
  inputPath: string,
  startMs: number,
  endMs: number,
  outPath: string
): Promise<void> {
  const start = msToTimestamp(startMs);
  const end = msToTimestamp(endMs);

  const ffmpegPath = ffmpegStatic || "ffmpeg";

  await runCmd(ffmpegPath, [
    "-y",
    "-ss",
    start,
    "-to",
    end,
    "-i",
    inputPath,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outPath,
  ]);
}

export async function makeVertical(
  inputPath: string,
  outPath: string
): Promise<void> {
  const ffmpegPath = ffmpegStatic || "ffmpeg";

  await runCmd(ffmpegPath, [
    "-y",
    "-i",
    inputPath,
    "-vf",
    "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outPath,
  ]);
}
