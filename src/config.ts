import dotenv from "dotenv";
dotenv.config();
function numberSetting(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}
const provider = process.env.TRANSLATION_PROVIDER ?? "mock";
if (!["mock", "groq", "openai"].includes(provider)) throw new Error("TRANSLATION_PROVIDER must be mock, groq or openai");
export const config = {
  production: process.env.NODE_ENV === "production",
  maxConcurrentSessions: numberSetting("MAX_CONCURRENT_SESSIONS", 2, 1, 20),
  maxTotalAudioSeconds: numberSetting("MAX_TOTAL_AUDIO_SECONDS", 3600, 1, 86400),
  port: numberSetting("PORT", 3000, 1, 65535),
  translationProvider: provider,
  demoPin: process.env.DEMO_PIN?.trim() ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  translationModel: process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-realtime-translate",
  maxSessionSeconds: numberSetting("MAX_SESSION_SECONDS", 300, 1, 3600),
  sourceTranscription: process.env.OPENAI_SOURCE_TRANSCRIPTION === "true",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqChatModel: process.env.GROQ_CHAT_MODEL ?? "llama-3.1-8b-instant",
  groqTranscriptionModel: process.env.GROQ_TRANSCRIPTION_MODEL ?? "whisper-large-v3-turbo",
  audioChunkMs: numberSetting("AUDIO_CHUNK_MS", 2500, 200, 10000),
  // Legacy, unused Realtime assistant prototype (openaiRealtime.ts).
  realtimeModel: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime",
  realtimeVoice: process.env.OPENAI_REALTIME_VOICE ?? "marin",
  transcriptionModel: process.env.OPENAI_TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe",
  clientSecretTtlSeconds: 600,
};
