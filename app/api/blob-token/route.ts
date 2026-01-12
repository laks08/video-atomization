import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import prisma from "../../../lib/db";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null;

  if (!body?.type) {
    return NextResponse.json(
      { error: "Missing event type" },
      { status: 400 }
    );
  }

  let createdVideoId: string | null = null;
  let transcriptVideoId: string | null = null;

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : null;
        const filename = payload?.filename ?? pathname.split("/").pop();
        const kind = payload?.kind ?? "video";

        if (!filename || typeof filename !== "string") {
          throw new Error("Missing filename in clientPayload");
        }

        const isTranscript = kind === "transcript";
        let videoId = payload?.videoId ?? null;

        if (!isTranscript) {
          if (!videoId) {
            const video = await prisma.video.create({
              data: {
                source_path: "pending",
                original_filename: filename,
              },
            });

            createdVideoId = video.id;
            videoId = video.id;
          } else {
            createdVideoId = videoId;
          }
        } else {
          if (!videoId || typeof videoId !== "string") {
            throw new Error("Transcript upload missing videoId");
          }
          transcriptVideoId = videoId;
        }

        return {
          allowedContentTypes: isTranscript
            ? ["application/json", "text/plain"]
            : ["video/mp4"],
          maximumSizeInBytes: isTranscript ? 10 * 1024 * 1024 : 2 * 1024 * 1024 * 1024,
          tokenPayload: JSON.stringify({
            videoId,
            originalFilename: filename,
            kind,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = tokenPayload ? JSON.parse(tokenPayload) : null;
        const videoId = payload?.videoId;
        const kind = payload?.kind;
        if (!videoId) {
          throw new Error("Upload completed without videoId");
        }
        if (kind === "video") {
          await prisma.video.update({
            where: { id: videoId },
            data: { source_path: blob.url },
          });
        }
      },
    });

    if (result.type === "blob.generate-client-token") {
      return NextResponse.json({
        ...result,
        videoId: createdVideoId ?? transcriptVideoId,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (createdVideoId) {
      await prisma.video.delete({ where: { id: createdVideoId } });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Token error" },
      { status: 500 }
    );
  }
}
