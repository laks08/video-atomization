export type TranscriptSegmentInput = {
  start_ms: number;
  end_ms: number;
  text: string;
};

export function normalizeTranscript(
  raw: unknown
): TranscriptSegmentInput[] {
  if (!Array.isArray(raw)) {
    throw new Error("Transcript JSON must be an array");
  }

  const segments: TranscriptSegmentInput[] = raw.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Transcript segment ${index} is not an object`);
    }

    const start = (item as { start_ms?: unknown }).start_ms;
    const end = (item as { end_ms?: unknown }).end_ms;
    const text = (item as { text?: unknown }).text;

    if (typeof start !== "number" || !Number.isFinite(start)) {
      throw new Error(`Transcript segment ${index} has invalid start_ms`);
    }

    if (typeof end !== "number" || !Number.isFinite(end)) {
      throw new Error(`Transcript segment ${index} has invalid end_ms`);
    }

    if (typeof text !== "string") {
      throw new Error(`Transcript segment ${index} has invalid text`);
    }

    const trimmedText = text.trim();
    if (!trimmedText) {
      throw new Error(`Transcript segment ${index} has empty text`);
    }

    if (start < 0) {
      throw new Error(`Transcript segment ${index} has negative start_ms`);
    }

    if (end <= start) {
      throw new Error(`Transcript segment ${index} end_ms must be > start_ms`);
    }

    return {
      start_ms: Math.floor(start),
      end_ms: Math.floor(end),
      text: trimmedText,
    };
  });

  return segments.sort((a, b) => a.start_ms - b.start_ms);
}
