import { config } from "./config.js";

const OPENAI_REALTIME_CLIENT_SECRETS_URL =
  "https://api.openai.com/v1/realtime/client_secrets";

type LanguageCode = "pl" | "fr";

type Language = {
  code: LanguageCode;
  englishName: string;
  nativeName: string;
};

const LANGUAGES: Record<LanguageCode, Language> = {
  pl: {
    code: "pl",
    englishName: "Polish",
    nativeName: "polski",
  },
  fr: {
    code: "fr",
    englishName: "French",
    nativeName: "francais",
  },
};

export type TranslationSessionRequest = {
  sourceLanguage?: string;
  targetLanguage?: string;
};

export class MissingOpenAIKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is missing");
    this.name = "MissingOpenAIKeyError";
  }
}

export class UnsupportedLanguagePairError extends Error {
  constructor(sourceLanguage: string, targetLanguage: string) {
    super(`Unsupported language pair: ${sourceLanguage} -> ${targetLanguage}`);
    this.name = "UnsupportedLanguagePairError";
  }
}

export class OpenAIRealtimeError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "OpenAIRealtimeError";
  }
}

function normalizeLanguage(value: string | undefined): LanguageCode {
  if (value === "fr") {
    return "fr";
  }

  return "pl";
}

function assertSupportedPair(sourceLanguage: LanguageCode, targetLanguage: LanguageCode) {
  if (sourceLanguage !== "pl" || targetLanguage !== "fr") {
    throw new UnsupportedLanguagePairError(sourceLanguage, targetLanguage);
  }
}

function buildInstructions(source: Language, target: Language): string {
  return [
    "You are a real-time interpreter, not a conversational assistant.",
    `Translate every user utterance from ${source.englishName} to natural spoken ${target.englishName}.`,
    `Speak only in ${target.englishName}. Never answer the user's questions yourself.`,
    "Preserve meaning, tone, names, numbers, and intent.",
    "Do not add explanations, summaries, greetings, or meta-comments.",
    "If the input is fragmented, produce the best short faithful translation.",
    "Keep responses concise to minimize latency.",
  ].join(" ");
}

function buildSessionPayload(sourceLanguage: LanguageCode, targetLanguage: LanguageCode) {
  const source = LANGUAGES[sourceLanguage];
  const target = LANGUAGES[targetLanguage];

  return {
    expires_after: {
      anchor: "created_at",
      seconds: config.clientSecretTtlSeconds,
    },
    session: {
      type: "realtime",
      model: config.realtimeModel,
      instructions: buildInstructions(source, target),
      output_modalities: ["audio"],
      audio: {
        input: {
          transcription: {
            model: config.transcriptionModel,
            language: source.code,
            prompt: `Rozmowa po ${source.nativeName}. Zapisuj wypowiedzi wiernie i bez tlumaczenia.`,
          },
          noise_reduction: {
            type: "near_field",
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 450,
            create_response: true,
            interrupt_response: true,
          },
        },
        output: {
          voice: config.realtimeVoice,
          speed: 1.0,
        },
      },
    },
  };
}

async function parseOpenAIResponse(response: Response) {
  const body = await response.text();

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return { raw: body };
  }
}

export async function createTranslationClientSecret(
  request: TranslationSessionRequest,
) {
  if (!config.openaiApiKey) {
    throw new MissingOpenAIKeyError();
  }

  const sourceLanguage = normalizeLanguage(request.sourceLanguage);
  const targetLanguage = normalizeLanguage(request.targetLanguage ?? "fr");

  assertSupportedPair(sourceLanguage, targetLanguage);

  const response = await fetch(OPENAI_REALTIME_CLIENT_SECRETS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildSessionPayload(sourceLanguage, targetLanguage)),
  });

  const data = await parseOpenAIResponse(response);

  if (!response.ok) {
    const openAIError = data.error as { message?: string } | undefined;
    throw new OpenAIRealtimeError(
      response.status,
      openAIError?.message ?? "OpenAI Realtime client secret request failed",
      data,
    );
  }

  return data;
}
