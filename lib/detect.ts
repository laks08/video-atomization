import prisma from "./db";
import { generateJson } from "./llm";

const SYSTEM_PROMPT = [
  "You are an assistant that selects highlight moments from a transcript.",
  "Return only strict JSON with no extra commentary.",
  "Avoid intro/outro when possible and pick meaningful topic changes.",
].join(" ");

function buildTranscript(
  segments: { start_ms: number; end_ms: number; text: string }[]
) {
  return segments
    .map((segment) => `[${segment.start_ms}-${segment.end_ms}] ${segment.text}`)
    .join("\n");
}

function parseJsonOrThrow(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("No JSON object found in LLM response");
    }
    const slice = trimmed.slice(start, end + 1);
    return JSON.parse(slice);
  }
}

function validateMoments(payload: unknown) {
  if (payload === null || payload === undefined) {
    throw new Error("LLM response must be an object");
  }

  const moments = (payload as { moments?: unknown }).moments;
  if (!Array.isArray(moments)) {
    throw new Error("LLM response must include moments array");
  }

  if (moments.length < 3 || moments.length > 5) {
    throw new Error("LLM must return 3 to 5 moments");
  }

  const normalized = moments.map((moment, index) => {
    if (typeof moment !== "object" || moment === null) {
      throw new Error(`Moment ${index} is not an object`);
    }

    const start = (moment as { start_ms?: unknown }).start_ms;
    const end = (moment as { end_ms?: unknown }).end_ms;
    const title = (moment as { title?: unknown }).title;

    if (typeof start !== "number" || !Number.isFinite(start) || start < 0) {
      throw new Error(`Moment ${index} has invalid start_ms`);
    }

    if (typeof end !== "number" || !Number.isFinite(end) || end <= start) {
      throw new Error(`Moment ${index} has invalid end_ms`);
    }

    if (typeof title !== "string" || !title.trim()) {
      throw new Error(`Moment ${index} has invalid title`);
    }

    return {
      start_ms: Math.floor(start),
      end_ms: Math.floor(end),
      title: title.trim(),
    };
  });

  return normalized.sort((a, b) => a.start_ms - b.start_ms);
}

async function getMoments(transcript: string) {
  const prompt = [
    "Given the transcript below, select 3 to 5 highlight-worthy moments.",
    "Avoid intro/outro when possible. Aim for 20-60 second clips.",
    "Return STRICT JSON only in this schema:",
    '{ "moments": [ { "start_ms": number, "end_ms": number, "title": string } ] }',
    "Transcript:",
    transcript,
  ].join("\n");

  const first = await generateJson(prompt, SYSTEM_PROMPT);

  try {
    return validateMoments(parseJsonOrThrow(first));
  } catch {
    const fixPrompt = [
      "Fix the JSON to match this schema exactly:",
      '{ "moments": [ { "start_ms": number, "end_ms": number, "title": string } ] }',
      "Return ONLY valid JSON.",
      "Here is the previous response:",
      first,
    ].join("\n");

    const second = await generateJson(fixPrompt, SYSTEM_PROMPT);
    return validateMoments(parseJsonOrThrow(second));
  }
}

export async function detectMoments(videoId: string): Promise<number> {
  const transcriptSegments = await prisma.transcriptSegment.findMany({
    where: { video_id: videoId },
    orderBy: { start_ms: "asc" },
  });

  if (transcriptSegments.length === 0) {
    throw new Error("No transcript segments found for this video");
  }

  const transcript = buildTranscript(transcriptSegments);
  const moments = await getMoments(transcript);

  const existing = await prisma.moment.findMany({
    where: { video_id: videoId },
    orderBy: { rank: "asc" },
  });

  if (existing.length > 0) {
    const targetCount = Math.min(existing.length, moments.length);
    const updates = moments.slice(0, targetCount);

    for (let i = 0; i < updates.length; i += 1) {
      const moment = updates[i];
      await prisma.moment.update({
        where: { id: existing[i].id },
        data: {
          rank: i + 1,
          start_ms: moment.start_ms,
          end_ms: moment.end_ms,
          title: moment.title,
        },
      });
    }

    return updates.length;
  }

  await prisma.moment.createMany({
    data: moments.map((moment, index) => ({
      video_id: videoId,
      rank: index + 1,
      start_ms: moment.start_ms,
      end_ms: moment.end_ms,
      title: moment.title,
    })),
  });

  return moments.length;
}
