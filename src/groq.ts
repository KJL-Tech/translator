import { config } from "./config.js";

export type LanguageCode = "pl" | "fr";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TRANSCRIPTIONS_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  pl: "Polish",
  fr: "French",
};

export class MissingGroqKeyError extends Error {
  constructor() {
    super("Brakuje GROQ_API_KEY w konfiguracji backendu.");
    this.name = "MissingGroqKeyError";
  }
}

export class GroqApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "GroqApiError";
  }
}

function assertGroqKey() {
  if (!config.groqApiKey) {
    throw new MissingGroqKeyError();
  }
}

async function parseJsonResponse(response: Response) {
  const body = await response.text();

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return { raw: body };
  }
}

function targetLanguage(sourceLanguage: LanguageCode): LanguageCode {
  return sourceLanguage === "pl" ? "fr" : "pl";
}

function cleanTranslation(text: string) {
  return text
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
}

export async function translateTextWithGroq(
  sourceText: string,
  sourceLanguage: LanguageCode,
) {
  assertGroqKey();

  const target = targetLanguage(sourceLanguage);
  const response = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.groqChatModel,
      temperature: 0,
      max_completion_tokens: 180,
      messages: [
        {
          role: "system",
          content: [
            "You are a real-time interpreter for a live voice call.",
            `Translate from ${LANGUAGE_NAMES[sourceLanguage]} to ${LANGUAGE_NAMES[target]}.`,
            `Return only the translated sentence in ${LANGUAGE_NAMES[target]}.`,
            "Do not explain. Do not answer the speaker. Preserve meaning, tone, names, and numbers.",
          ].join(" "),
        },
        {
          role: "user",
          content: sourceText,
        },
      ],
    }),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = data.error as { message?: string } | undefined;
    throw new GroqApiError(
      response.status,
      error?.message ?? "Groq chat completion failed",
      data,
    );
  }

  const choices = data.choices as
    | Array<{ message?: { content?: string } }>
    | undefined;
  const translatedText = choices?.[0]?.message?.content;

  if (!translatedText) {
    throw new GroqApiError(502, "Groq did not return translated text", data);
  }

  return cleanTranslation(translatedText);
}

function audioFileName(mimeType: string) {
  const normalized = mimeType.toLowerCase();

  if (normalized.includes("ogg")) {
    return "speech.ogg";
  }

  if (normalized.includes("mp4")) {
    return "speech.m4a";
  }

  if (normalized.includes("mpeg") || normalized.includes("mp3")) {
    return "speech.mp3";
  }

  if (normalized.includes("wav")) {
    return "speech.wav";
  }

  return "speech.webm";
}

export async function transcribeAudioWithGroq(
  audio: Buffer,
  mimeType: string,
  language: LanguageCode,
) {
  assertGroqKey();

  const formData = new FormData();
  formData.append("model", config.groqTranscriptionModel);
  formData.append("language", language);
  formData.append("response_format", "json");
  formData.append(
    "file",
    new Blob([audio as unknown as BlobPart], {
      type: mimeType || "audio/webm",
    }),
    audioFileName(mimeType),
  );

  const response = await fetch(GROQ_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.groqApiKey}`,
    },
    body: formData,
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const error = data.error as { message?: string } | undefined;
    throw new GroqApiError(
      response.status,
      error?.message ?? "Groq audio transcription failed",
      data,
    );
  }

  const text = typeof data.text === "string" ? data.text.trim() : "";
  return text;
}

export async function translateAudioWithGroq(
  audio: Buffer,
  mimeType: string,
  sourceLanguage: LanguageCode,
) {
  const transcript = await transcribeAudioWithGroq(audio, mimeType, sourceLanguage);

  if (!transcript) {
    return null;
  }

  const translatedText = await translateTextWithGroq(transcript, sourceLanguage);

  return {
    sourceText: transcript,
    translatedText,
  };
}
