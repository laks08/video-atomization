"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

type Props = {
  videoId: string;
};

export default function ProcessForm({ videoId }: Props) {
  const router = useRouter();
  const [transcriptUrl, setTranscriptUrl] = useState<string>("");
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploadingTranscript, setIsUploadingTranscript] = useState<boolean>(
    false
  );
  const [isEnqueuing, setIsEnqueuing] = useState<boolean>(false);

  async function handleTranscriptUpload() {
    if (!transcriptFile) {
      setUploadStatus("Select a transcript file first.");
      return;
    }

    setUploadStatus("Uploading transcript...");
    setUploadProgress(0);
    setIsUploadingTranscript(true);

    try {
      const result = await upload(
        `transcripts/${videoId}/${transcriptFile.name}`,
        transcriptFile,
        {
          access: "public",
          contentType: transcriptFile.type || "application/json",
          handleUploadUrl: "/api/blob-token",
          clientPayload: JSON.stringify({
            filename: transcriptFile.name,
            kind: "transcript",
            videoId,
          }),
          multipart: false,
          onUploadProgress: (event) => {
            if (event.total) {
              setUploadProgress(
                Math.round((event.loaded / event.total) * 100)
              );
            }
          },
        }
      );

      setTranscriptUrl(result.url);
      setUploadStatus("Transcript uploaded.");
    } catch (err) {
      setUploadStatus(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploadingTranscript(false);
    }
  }

  async function handleProcess() {
    if (!transcriptUrl) {
      setStatus("Provide a transcript URL.");
      return;
    }

    setStatus("Enqueuing...");
    setIsEnqueuing(true);

    try {
      const res = await fetch(`/api/videos/${videoId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptUrl }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Failed to enqueue");
      }

      if (body.workerTrigger) {
        setStatus(`Jobs enqueued (${body.workerTrigger}).`);
      } else {
        setStatus("Jobs enqueued.");
      }
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to enqueue");
    } finally {
      setIsEnqueuing(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div>
        <input
          type="text"
          placeholder="Transcript URL"
          value={transcriptUrl}
          onChange={(event) => setTranscriptUrl(event.target.value)}
          style={{ width: 420 }}
        />
        <button
          type="button"
          onClick={handleProcess}
          disabled={isEnqueuing}
          style={{ marginLeft: 8 }}
        >
          {isEnqueuing ? "Enqueuing..." : "Enqueue processing"}
        </button>
      </div>
      <div style={{ marginTop: 8 }}>
        <input
          type="file"
          accept="application/json,text/plain"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setTranscriptFile(selected);
          }}
        />
        <button
          type="button"
          onClick={handleTranscriptUpload}
          disabled={isUploadingTranscript}
          style={{ marginLeft: 8 }}
        >
          {isUploadingTranscript ? "Uploading..." : "Upload transcript"}
        </button>
        {uploadProgress > 0 ? <div>Progress: {uploadProgress}%</div> : null}
        {uploadStatus ? <div>{uploadStatus}</div> : null}
      </div>
      {status ? <div>{status}</div> : null}
    </div>
  );
}
