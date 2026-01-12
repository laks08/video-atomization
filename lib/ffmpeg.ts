import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, chmod } from "node:fs/promises";
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

import path from "node:path";
import { existsSync } from "node:fs";

function resolveFfmpegPath(): string {
  // 1. Manually check environment variable
  if (process.env.FFMPEG_PATH) {
    console.log(`[ffmpeg] Using FFMPEG_PATH: ${process.env.FFMPEG_PATH}`);
    return process.env.FFMPEG_PATH;
  }

  // 2. Check the path reported by ffmpeg-static
  let candidatePath = ffmpegStatic;
  if (candidatePath && existsSync(candidatePath)) {
    console.log(`[ffmpeg] Found at default path: ${candidatePath}`);
    return candidatePath;
  }
  console.log(`[ffmpeg] Default path not found: ${candidatePath}`);

  // 3. Fallback: Search in common node_modules locations relative to CWD
  // In Vercel, process.cwd() is usually /var/task
  const cwd = process.cwd();
  const searchPaths = [
    path.join(cwd, "node_modules", "ffmpeg-static", "ffmpeg"),
    path.join(cwd, "node_modules", "ffmpeg-static", "b6.0", "ffmpeg"), // some versions use subdirs
    // Handle pnpm structure
    ...[
      "5.3.0", "5.2.0", "5.1.0"
    ].map(v => path.join(cwd, "node_modules", ".pnpm", `ffmpeg-static@${v}`, "node_modules", "ffmpeg-static", "ffmpeg"))
  ];

  for (const p of searchPaths) {
    if (existsSync(p)) {
      console.log(`[ffmpeg] Found binary at fallback location: ${p}`);
      return p;
    }
  }

  // 4. Debug: List files to find where it is
  if (process.env.VERCEL) {
    console.log("[ffmpeg] Debugging file system...");
    try {
      const { readdirSync, statSync } = require("node:fs");

      // Helper to valid recursive search
      const findFile = (dir: string, pattern: string, depth = 0): string | null => {
        if (depth > 4) return null; // limit depth
        try {
          const files = readdirSync(dir);
          for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
              if (file === 'node_modules' || file === '.next') {
                const res = findFile(fullPath, pattern, depth + 1);
                if (res) return res;
              }
            } else if (file === pattern) {
              return fullPath;
            }
          }
        } catch (e) { /* ignore access errors */ }
        return null;
      };

      console.log(`[ffmpeg] CWD: ${process.cwd()}`);

      // Look for 'ffmpeg' binary starting from root
      const found = findFile(process.cwd(), 'ffmpeg');
      if (found) {
        console.log(`[ffmpeg] FOUND BINARY AT: ${found}`);
        return found;
      } else {
        console.log("[ffmpeg] COULD NOT FIND BINARY IN CWD SEARCH");
      }

    } catch (e) {
      console.error("[ffmpeg] Error during debug search:", e);
    }
  }

  // 5. Last resort: just "ffmpeg" (system path)
  console.warn('[ffmpeg] No binary found in expected locations. Falling back to "ffmpeg"');
  return "ffmpeg";
}

async function ensureExecutable(filePath: string) {
  // If it's just "ffmpeg", we can't chmod it, so skip
  if (filePath === "ffmpeg") return;

  try {
    await access(filePath);
    console.log(`[ffmpeg] Binary confirmed at: ${filePath}`);
  } catch (err) {
    console.error(`[ffmpeg] Binary not found during verify at: ${filePath}`);
    throw new Error(`FFmpeg binary not accessible at ${filePath}`);
  }

  try {
    await access(filePath, constants.X_OK);
    console.log(`[ffmpeg] Binary is executable`);
  } catch {
    console.log(`[ffmpeg] Making binary executable: ${filePath}`);
    try {
      await chmod(filePath, 0o755);
      console.log(`[ffmpeg] Successfully made binary executable`);
    } catch (chmodErr) {
      console.error(`[ffmpeg] Failed to chmod:`, chmodErr);
      // Don't throw - the binary might still work
    }
  }
}

export async function extractClip(
  inputPath: string,
  startMs: number,
  endMs: number,
  outPath: string
): Promise<void> {
  const start = msToTimestamp(startMs);
  const end = msToTimestamp(endMs);

  const ffmpegPath = resolveFfmpegPath();
  await ensureExecutable(ffmpegPath);

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
  const ffmpegPath = resolveFfmpegPath();
  await ensureExecutable(ffmpegPath);

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
