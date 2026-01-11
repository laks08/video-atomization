import { Ollama } from "ollama";

const DEFAULT_BASE_URL = "https://ollama.com";
const DEFAULT_MODEL = "gemini-3-flash-preview:cloud";

function createClient() {
  const host = process.env.OLLAMA_HOST ?? DEFAULT_BASE_URL;
  const apiKey = process.env.OLLAMA_API_KEY;

  if (!apiKey) {
    throw new Error("OLLAMA_API_KEY is not set");
  }

  return new Ollama({
    host,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export async function generateText(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const model = process.env.LLM_MODEL ?? DEFAULT_MODEL;
  const ollama = createClient();

  const response = await ollama.chat({
    model,
    stream: false,
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: prompt },
    ],
  });

  const content = response.message?.content;
  if (!content) {
    throw new Error("LLM response missing message content");
  }

  return content.trim();
}

export async function generateJson(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const model = process.env.LLM_MODEL ?? DEFAULT_MODEL;
  const ollama = createClient();

  const response = await ollama.chat({
    model,
    stream: false,
    format: "json",
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: prompt },
    ],
  });

  const content = response.message?.content;
  if (!content) {
    throw new Error("LLM response missing message content");
  }

  return content.trim();
}
