"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

export default function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  async function handleUpload() {
    if (!file) {
      setStatus("Select a file first.");
      return;
    }

    setStatus("Uploading...");
    setProgress(0);
    setIsUploading(true);

    try {
      const createRes = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });

      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create video");
      }

      const { id: videoId } = (await createRes.json()) as { id: string };

      const result = await upload(`videos/${videoId}/${file.name}`, file, {
        access: "public",
        contentType: file.type || "video/mp4",
        handleUploadUrl: "/api/blob-token",
        clientPayload: JSON.stringify({
          filename: file.name,
          kind: "video",
          videoId,
        }),
        multipart: true,
        onUploadProgress: (event) => {
          if (event.total) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      });

      await fetch(`/api/videos/${videoId}/source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: result.url }),
      });

      setStatus("Upload complete.");
      setFile(null);
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section style={{ marginBottom: 24 }}>
      <h2>Upload</h2>
      <input
        type="file"
        accept="video/mp4"
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          setFile(selected);
        }}
      />
      <button
        type="button"
        onClick={handleUpload}
        disabled={isUploading}
        style={{ marginLeft: 12 }}
      >
        {isUploading ? "Uploading..." : "Upload to Blob"}
      </button>
      {progress > 0 ? <div>Progress: {progress}%</div> : null}
      {status ? <div>{status}</div> : null}
    </section>
  );
}
