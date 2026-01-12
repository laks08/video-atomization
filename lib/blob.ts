import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { put } from "@vercel/blob";

function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  }
  return token;
}

export function isRemoteUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

export async function downloadToTempFile(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "video-atomization-")
  );
  const filePath = path.join(tempDir, filename);
  await writeFile(filePath, Buffer.from(arrayBuffer));
  return filePath;
}

export async function uploadFileToBlob(filePath: string, blobPath: string) {
  const stream = createReadStream(filePath);
  const result = await put(blobPath, stream, {
    access: "public",
    token: getBlobToken(),
  });

  return result.url;
}

export async function cleanupTempFile(filePath: string) {
  await rm(filePath, { force: true });
}
