import WebSocket from "ws";
import { config } from "./config.js";

export type TranslationCallbacks = {
  ready: () => void;
  delta: (kind: "audio" | "source" | "translation", delta: string) => void;
  error: (code: string) => void;
  stopped: (reason: string, seconds: number) => void;
};
export interface TranslationSession {
  append(audio: string): void;
  stop(reason?: string): void;
}
type Options = {
  apiKey?: string;
  model?: string;
  maxSeconds?: number;
  transcription?: boolean;
  connect?: (url: string, options: WebSocket.ClientOptions) => WebSocket;
};

// One session per source speaker. The long-lived API key stays on the server.
export class OpenAITranslationSession implements TranslationSession {
  private socket: WebSocket;
  private ready = false;
  private closing = false;
  private finished = false;
  private reason = "stopped";
  private bytes = 0;
  private startedAt = Date.now();
  private setupTimer: ReturnType<typeof setTimeout>;
  private limitTimer?: ReturnType<typeof setTimeout>;
  private closeTimer?: ReturnType<typeof setTimeout>;
  private watchdog: ReturnType<typeof setInterval>;
  private lastAudioAt = Date.now();
  private maxSeconds: number;

  constructor(targetLanguage: "pl" | "fr", private callbacks: TranslationCallbacks, options: Options = {}) {
    const apiKey = options.apiKey ?? config.openaiApiKey;
    if (!apiKey || apiKey === "sk-proj-your-key-here") throw new Error("missing_openai_key");
    this.maxSeconds = options.maxSeconds ?? config.maxSessionSeconds;
    const model = options.model ?? config.translationModel;
    this.socket = (options.connect ?? ((url, settings) => new WebSocket(url, settings)))(
      `wss://api.openai.com/v1/realtime/translations?model=${encodeURIComponent(model)}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, handshakeTimeout: 15000, maxPayload: 2 * 1024 * 1024 },
    );
    this.setupTimer = setTimeout(() => this.fail("openai_timeout"), 15000);
    this.watchdog = setInterval(() => {
      if (this.ready && !this.closing && Date.now() - this.lastAudioAt > 10000) this.stop("audio_timeout");
    }, 1000);
    this.socket.on("message", (raw) => {
      if (this.finished) return;
      try {
        const event = JSON.parse(raw.toString());
        switch (event.type) {
          case "session.created":
            if (!this.closing) this.send({ type: "session.update", session: { audio: {
              input: {
                transcription: (options.transcription ?? config.sourceTranscription) ? { model: "gpt-realtime-whisper" } : null,
                noise_reduction: { type: "near_field" },
              },
              output: { language: targetLanguage },
            } } });
            break;
          case "session.updated":
            if (this.closing || this.ready) break;
            clearTimeout(this.setupTimer);
            this.ready = true;
            this.startedAt = this.lastAudioAt = Date.now();
            this.limitTimer = setTimeout(() => this.stop("time_limit"), this.maxSeconds * 1000);
            callbacks.ready();
            break;
          case "session.output_audio.delta":
            if ((event.sample_rate ?? 24000) !== 24000 || (event.channels ?? 1) !== 1 || (event.format ?? "pcm16") !== "pcm16") {
              this.fail("unsupported_output_audio");
              break;
            }
            if (typeof event.delta === "string") callbacks.delta("audio", event.delta);
            break;
          case "session.input_transcript.delta":
          case "session.output_transcript.delta":
            if (typeof event.delta === "string") callbacks.delta(event.type.includes("input_") ? "source" : "translation", event.delta);
            break;
          case "session.closed":
            if (!this.closing) this.reason = "upstream_closed";
            this.finish();
            break;
          case "error":
            this.fail("openai_rejected");
            break;
        }
      } catch { this.fail("invalid_openai_response"); }
    });
    this.socket.on("error", () => this.fail("openai_connection_failed"));
    this.socket.on("close", () => {
      if (!this.closing) this.reason = "upstream_closed";
      this.finish();
    });
  }

  append(audio: string) {
    if (!this.ready || this.closing || this.finished) return;
    // Exactly 200 ms of 24 kHz PCM16, including silence; never WAV or compressed audio.
    if (typeof audio !== "string" || audio.length !== 12800 || !/^[A-Za-z0-9+/]+$/.test(audio)) {
      this.fail("invalid_audio");
      return;
    }
    const bytes = Buffer.byteLength(audio, "base64");
    const nextSeconds = (this.bytes + bytes) / 48000;
    if (nextSeconds > this.maxSeconds) { this.stop("time_limit"); return; }
    // Also bound uploads: a client cannot submit hours of audio instantly.
    if (nextSeconds > (Date.now() - this.startedAt) / 1000 + 2 || this.socket.bufferedAmount > 256000) {
      this.fail("audio_backpressure");
      return;
    }
    this.bytes += bytes;
    this.lastAudioAt = Date.now();
    this.send({ type: "session.input_audio_buffer.append", audio });
  }

  stop(reason = "stopped") {
    if (this.closing || this.finished) return;
    this.closing = true;
    this.reason = reason;
    clearTimeout(this.setupTimer);
    clearTimeout(this.limitTimer);
    if (this.ready && this.socket.readyState === WebSocket.OPEN) {
      this.send({ type: "session.close" });
      this.closeTimer = setTimeout(() => this.finish(), 3000);
    } else this.finish();
  }

  private send(event: object) {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(event));
  }
  private fail(code: string) {
    if (this.finished) return;
    this.reason = code;
    this.callbacks.error(code);
    this.finish();
  }
  private finish() {
    if (this.finished) return;
    this.finished = true;
    clearTimeout(this.setupTimer);
    clearTimeout(this.limitTimer);
    clearTimeout(this.closeTimer);
    clearInterval(this.watchdog);
    this.socket.terminate();
    this.callbacks.stopped(this.reason, this.bytes / 48000);
  }
}
