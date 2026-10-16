import express from "express";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket, { WebSocketServer } from "ws";
import { config } from "./config.js";
import { translateAudioWithGroq, translateTextWithGroq, type LanguageCode } from "./groq.js";
import { OpenAITranslationSession, type TranslationCallbacks, type TranslationSession } from "./openaiTranslation.js";

type Client = {
  id: string;
  roomId: string;
  language: LanguageCode;
  socket: WebSocket;
  session?: TranslationSession;
  sessionId?: string;
  lastStart: number;
  busy: boolean;
  speaking: boolean;
};
type SessionFactory = (target: LanguageCode, callbacks: TranslationCallbacks) => TranslationSession;
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

export function createTranslatorServer(createSession: SessionFactory = (target, callbacks) => new OpenAITranslationSession(target, callbacks)) {
  if (config.production && (!config.demoPin || config.demoPin.length < 8 || config.demoPin === "12345678")) {
    throw new Error("Production requires a unique DEMO_PIN of at least 8 characters");
  }
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "microphone=(self), camera=(), geolocation=()");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; media-src 'self' blob:; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader("Cache-Control", "no-store");
    if (config.production) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    next();
  });
  app.get("/robots.txt", (_req,res) => res.type("text/plain").send("User-agent: *\nDisallow: /\n"));
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024 });
  const clients = new Map<WebSocket, Client>();
  const alive = new Set<WebSocket>();
  const attempts = new Map<string, { count: number; until: number }>();
  const addresses = new Map<WebSocket, string>();
  let totalAudioSeconds = 0;
  function presence(roomId: string) { broadcast(roomId, "presence", { room: snapshot(roomId) }); }
  const roomClients = (roomId: string) => [...clients.values()].filter(client => client.roomId === roomId);
  function send(socket: WebSocket, type: string, payload: Record<string, unknown> = {}) {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 2 * 1024 * 1024) { socket.terminate(); return; }
    socket.send(JSON.stringify({ type, ...payload }));
  }
  function error(socket: WebSocket, code: string, message = code) { send(socket, "error", { code, message }); }
  function broadcast(roomId: string, type: string, payload: Record<string, unknown>) {
    for (const client of roomClients(roomId)) send(client.socket, type, payload);
  }
  function snapshot(roomId: string) {
    const members = roomClients(roomId);
    return { roomId, participants: members.length,
      polishSpeakers: members.filter(client => client.language === "pl").length,
      frenchSpeakers: members.filter(client => client.language === "fr").length,
      members: members.map(client => ({ id: client.id, language: client.language, speaking: client.speaking })) };
  }
  function leave(socket: WebSocket) {
    const client = clients.get(socket);
    if (!client) return;
    clients.delete(socket);
    client.session?.stop("disconnected");
    for (const peer of roomClients(client.roomId)) peer.session?.stop("peer_left");
    broadcast(client.roomId, "presence", { room: snapshot(client.roomId) });
  }
  app.get("/api/health", (_req, res) => res.json({
    ok: true, translationMode: config.translationProvider,
    hasOpenAIKey: Boolean(config.openaiApiKey) && config.openaiApiKey !== "sk-proj-your-key-here",
    hasGroqKey: Boolean(config.groqApiKey), requiresDemoPin: Boolean(config.demoPin),
    audioChunkMs: config.audioChunkMs, model: config.translationModel,
    maxSessionSeconds: config.maxSessionSeconds, sourceTranscription: config.sourceTranscription,
    estimatedUsdPerMinute: 0.034 + (config.sourceTranscription ? 0.017 : 0),
  }));
  function join(socket: WebSocket, message: Record<string, unknown>) {
    if (clients.has(socket)) { error(socket, "already_joined"); return; }
    const address = addresses.get(socket) ?? "unknown";
    const attempt = attempts.get(address);
    if (attempt && attempt.until > Date.now() && attempt.count >= 10) { error(socket, "too_many_attempts"); return; }
    if (config.demoPin && message.demoPin !== config.demoPin) {
      const counter = attempt && attempt.until > Date.now() ? attempt : { count: 0, until: Date.now() + 60000 };
      counter.count++; attempts.set(address, counter);
      error(socket, "invalid_demo_pin"); return;
    }
    const roomId = typeof message.roomId === "string" ? message.roomId.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) : "";
    const language = message.language;
    if (!roomId || (language !== "pl" && language !== "fr")) { error(socket, "invalid_room"); return; }
    if (config.translationProvider === "openai") {
      const peers = roomClients(roomId).filter(client => client.socket !== socket);
      if (peers.length >= 2 || peers.some(client => client.language === language)) { error(socket, "room_full"); return; }
    }
    leave(socket);
    clients.set(socket, { id: randomUUID(), roomId, language, socket, lastStart: 0, busy: false, speaking: false });
    send(socket, "joined", { clientId: clients.get(socket)!.id, room: snapshot(roomId), translationMode: config.translationProvider });
    broadcast(roomId, "presence", { room: snapshot(roomId) });
  }
  function start(client: Client) {
    if (config.translationProvider !== "openai") { error(client.socket, "openai_disabled"); return; }
    if (client.session) { error(client.socket, "session_active"); return; }
    if (totalAudioSeconds >= config.maxTotalAudioSeconds) { error(client.socket, "budget_limit"); return; }
    if ([...clients.values()].filter(member => member.session).length >= config.maxConcurrentSessions) { error(client.socket, "server_busy"); return; }
    if (!roomClients(client.roomId).some(peer => peer.language !== client.language)) { error(client.socket, "peer_required"); return; }
    if (Date.now() - client.lastStart < 2000) { error(client.socket, "start_rate_limit"); return; }
    client.lastStart = Date.now();
    const sessionId = randomUUID();
    client.sessionId = sessionId;
    const targetLanguage = client.language === "pl" ? "fr" : "pl";
    try {
      client.session = createSession(targetLanguage, {
        ready: () => {
          client.speaking = true;
          send(client.socket, "openai_started", { sessionId, maxSessionSeconds: config.maxSessionSeconds });
          presence(client.roomId);
        },
        delta: (kind, delta) => {
          // Disconnected speakers' late results must not leak into a reused room.
          if (clients.get(client.socket) !== client) return;
          const payload = { sessionId, speakerId: client.id, sourceLanguage: client.language, targetLanguage, kind, delta };
          if (kind === "audio") {
            for (const peer of roomClients(client.roomId)) if (peer.language === targetLanguage) send(peer.socket, "openai_delta", payload);
          } else broadcast(client.roomId, "openai_delta", payload);
        },
        error: code => error(client.socket, code),
        stopped: (reason, seconds) => {
          if (client.sessionId !== sessionId) return;
          client.session = undefined;
          client.sessionId = undefined;
          client.speaking = false;
          presence(client.roomId);
          send(client.socket, "openai_stopped", { sessionId, reason, seconds,
            estimatedUsd: seconds / 60 * (0.034 + (config.sourceTranscription ? 0.017 : 0)) });
        },
      });
    } catch (caught) {
      client.sessionId = undefined;
      error(client.socket, caught instanceof Error && caught.message === "missing_openai_key" ? "missing_openai_key" : "openai_connection_failed");
      send(client.socket, "openai_stopped", { sessionId, reason: "setup_failed", seconds: 0, estimatedUsd: 0 });
    }
  }
  async function message(socket: WebSocket, raw: string) {
    let data: Record<string, unknown>;
    try { data = JSON.parse(raw); if (!data || typeof data !== "object") throw new Error(); }
    catch { error(socket, "invalid_message"); return; }
    if (data.type === "join") { join(socket, data); return; }
    if (data.type === "ping") { send(socket, "pong"); return; }
    const client = clients.get(socket);
    if (!client) { error(socket, "not_joined"); return; }
    switch (data.type) {
      case "openai_start": start(client); return;
      case "openai_stop":
        client.speaking = false;
        presence(client.roomId);
        if (client.session) client.session.stop();
        else send(socket, "openai_stopped", { reason: "stopped", seconds: 0, estimatedUsd: 0 });
        return;
      case "openai_audio":
        if (client.session && data.sessionId === client.sessionId && typeof data.audio === "string") {
          if (totalAudioSeconds >= config.maxTotalAudioSeconds) {
            for (const member of clients.values()) member.session?.stop("budget_limit");
            return;
          }
          if (client.speaking && data.audio.length === 12800 && /^[A-Za-z0-9+/]+$/.test(data.audio)) totalAudioSeconds += 0.2;
          client.session.append(data.audio);
        }
        return;
    }
    if (data.type !== "source_text" && data.type !== "source_audio") return;
    if (config.translationProvider === "openai") { error(socket, "voice_only"); return; }
    if (client.busy) { error(socket, "busy"); return; }
    client.busy = true;
    try {
      let sourceText = typeof data.text === "string" ? data.text.trim().slice(0, 4000) : "";
      let translatedText: string;
      if (data.type === "source_audio") {
        if (config.translationProvider !== "groq" || typeof data.audioBase64 !== "string") { error(socket, "audio_requires_groq"); return; }
        send(socket, "speech_processing");
        const result = await translateAudioWithGroq(Buffer.from(data.audioBase64, "base64"), typeof data.mimeType === "string" ? data.mimeType : "audio/wav", client.language);
        if (!result) { send(socket, "speech_ignored"); return; }
        sourceText = result.sourceText;
        translatedText = result.translatedText;
      } else {
        if (!sourceText) return;
        translatedText = config.translationProvider === "groq" ? await translateTextWithGroq(sourceText, client.language) : mockTranslate(sourceText, client.language);
      }
      if (clients.get(socket) !== client) return;
      broadcast(client.roomId, "translation", { id: randomUUID(), speakerId: client.id,
        sourceLanguage: client.language, targetLanguage: client.language === "pl" ? "fr" : "pl",
        sourceText, translatedText, mode: config.translationProvider, createdAt: new Date().toISOString() });
      if (data.type === "source_audio") send(socket, "speech_processed");
    } catch { error(socket, "translation_error", "Nie udalo sie przetworzyc wypowiedzi / Echec de la traduction."); }
    finally { client.busy = false; }
  }
  server.on("upgrade", (req, socket, head) => {
    // Browser clients must originate from this app. Non-browser test clients may omit Origin.
    const origin = req.headers.origin;
    let allowed = true;
    if (origin) { try { allowed = new URL(origin).host === req.headers.host; } catch { allowed = false; } }
    if (req.url !== "/ws" || !allowed || wss.clients.size >= 32) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => { addresses.set(ws, req.socket.remoteAddress ?? "unknown"); wss.emit("connection", ws); });
  });
  wss.on("connection", socket => {
    alive.add(socket);
    let messageCount = 0; let messageWindow = Date.now();
    const joinTimer = setTimeout(() => { if (!clients.has(socket)) socket.close(1008, "Join timeout"); }, 30000);
    socket.on("pong", () => alive.add(socket));
    socket.on("message", (raw, binary) => {
      if (Date.now() - messageWindow > 1000) { messageCount = 0; messageWindow = Date.now(); }
      if (++messageCount > 40) { leave(socket); socket.close(1008, "Rate limit"); return; }
      if (!binary) void message(socket, raw.toString()).catch(() => error(socket, "invalid_message"));
    });
    socket.on("close", () => { clearTimeout(joinTimer); addresses.delete(socket); alive.delete(socket); leave(socket); });
    socket.on("error", () => leave(socket));
  });
  const heartbeat = setInterval(() => {
    for (const [address, attempt] of attempts) if (attempt.until <= Date.now()) attempts.delete(address);
    for (const socket of wss.clients) {
      if (!alive.delete(socket)) { leave(socket); socket.terminate(); }
      else socket.ping();
    }
  }, 15000);
  heartbeat.unref();
  server.on("close", () => {
    clearInterval(heartbeat);
    for (const socket of wss.clients) { leave(socket); socket.terminate(); }
    wss.close();
  });
  app.use(express.static(publicDir));
  app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
  return { server, wss };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server, wss } = createTranslatorServer();
  server.listen(config.port, "0.0.0.0", () => console.log(`[server] Translator: http://localhost:${config.port} (${config.translationProvider})`));
  const shutdown = () => { for (const socket of wss.clients) socket.close(); server.close(); };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function mockTranslate(sourceText: string, sourceLanguage: LanguageCode) {
  const normalized = stripDiacritics(sourceText)
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .trim();

  const plToFr = new Map<string, string>([
    ["czesc", "Bonjour."],
    ["dzien dobry", "Bonjour."],
    ["dobry wieczor", "Bonsoir."],
    ["jak sie masz", "Comment ca va ?"],
    ["mam na imie kacper", "Je m'appelle Kacper."],
    ["to jest test", "Ceci est un test."],
    ["test", "Test."],
    ["test czy to wszystko dziala", "Test pour verifier que tout fonctionne."],
    ["czy to wszystko dziala", "Est-ce que tout fonctionne ?"],
    ["wszystko dziala", "Tout fonctionne."],
    ["mowie po polsku a ty slyszysz po francusku", "Je parle polonais et tu entends en francais."],
    ["to jest wersja testowa bez gpt", "Ceci est une version de test sans GPT."],
    ["dziekuje", "Merci."],
    ["do widzenia", "Au revoir."],
  ]);

  const frToPl = new Map<string, string>([
    ["bonjour", "Dzien dobry."],
    ["bonsoir", "Dobry wieczor."],
    ["comment ca va", "Jak sie masz?"],
    ["je m'appelle kacper", "Mam na imie Kacper."],
    ["ceci est un test", "To jest test."],
    ["test pour verifier que tout fonctionne", "Test, czy wszystko dziala."],
    ["est-ce que tout fonctionne", "Czy wszystko dziala?"],
    ["tout fonctionne", "Wszystko dziala."],
    ["je parle francais et tu entends en polonais", "Mowie po francusku, a ty slyszysz po polsku."],
    ["merci", "Dziekuje."],
    ["au revoir", "Do widzenia."],
  ]);

  if (sourceLanguage === "fr") {
    return frToPl.get(normalized) ?? `[TEST bez GPT] ${sourceText}`;
  }

  return plToFr.get(normalized) ?? `[TEST bez GPT] ${sourceText}`;
}


