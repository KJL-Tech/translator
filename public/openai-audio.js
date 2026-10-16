export class OpenAIAudio {
  constructor(onChunk, onError, onLevel = () => {}) {
    this.onChunk = onChunk;
    this.onLevel = onLevel;
    this.onError = onError;
    this.context = null;
    this.stream = null;
    this.source = null;
    this.processor = null;
    this.active = false;
    this.generation = 0;
    this.playback = new Set();
    this.nextTime = 0;
    this.silentSeconds = 0;
  }
  async unlock() {
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext({ sampleRate: 24000 });
    }
    await this.context.resume();
  }
  async prepare() {
    this.stopCapture();
    const generation = this.generation;
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) throw new Error("secure_microphone_required");
    await this.unlock();
    if (generation !== this.generation) return false;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return false; }
    this.stream = stream;
    stream.getAudioTracks()[0].addEventListener("ended", () => {
      if (this.stream === stream) this.onError("microphone_ended");
    });
    await this.context.audioWorklet.addModule("/capture-worklet.js");
    if (generation !== this.generation) return false;
    this.source = this.context.createMediaStreamSource(stream);
    this.processor = new AudioWorkletNode(this.context, "translator-capture");
    this.processor.port.onmessage = ({ data }) => {
      const pcm = new DataView(data);
      let energy = 0;
      for (let i = 0; i < pcm.byteLength; i += 2) energy += (pcm.getInt16(i,true) / 32768) ** 2;
      this.onLevel(Math.min(1, Math.sqrt(energy / (pcm.byteLength/2)) * 5));
      if (!this.active) return;
      const bytes = new Uint8Array(data);
      let text = "";
      for (const byte of bytes) text += String.fromCharCode(byte);
      this.onChunk(btoa(text));
    };
    this.source.connect(this.processor);
    // Worklet produces silence on its output, so the local microphone is never played back.
    this.processor.connect(this.context.destination);
    return true;
  }
  async testSound() {
    await this.unlock();
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(0.06,this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,this.context.currentTime+0.22);
    oscillator.connect(gain); gain.connect(this.context.destination);
    oscillator.start(); oscillator.stop(this.context.currentTime+0.25);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
  start() { this.active = true; }
  stopCapture() {
    this.generation++;
    this.active = false;
    if (this.processor) { this.processor.port.onmessage = null; this.processor.disconnect(); }
    this.source?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    this.processor = this.source = this.stream = null;
  }
  play(base64) {
    if (!this.context || this.context.state !== "running") { this.onError("playback_blocked"); return; }
    const text = atob(base64);
    if (!text.length || text.length % 2) { this.onError("invalid_audio"); return; }
    const view = new DataView(Uint8Array.from(text, character => character.charCodeAt(0)).buffer);
    // Long runs of near-digital silence from the translator must not build
    // a playback backlog. Keep a short pause and preserve every voiced delta.
    let peak = 0;
    for (let i = 0; i < view.byteLength; i += 2) peak = Math.max(peak, Math.abs(view.getInt16(i, true)));
    if (peak <= 8) {
      this.silentSeconds += text.length / 48000;
      if (this.silentSeconds > 0.4) return;
    } else {
      this.silentSeconds = 0;
    }
    const buffer = this.context.createBuffer(1, text.length / 2, 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
    if (this.nextTime - this.context.currentTime > 10) { this.clearPlayback(); this.onError("playback_delayed"); return; }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    this.playback.add(source);
    source.onended = () => { this.playback.delete(source); source.disconnect(); };
    const start = Math.max(this.context.currentTime + 0.03, this.nextTime);
    source.start(start);
    this.nextTime = start + buffer.duration;
  }
  clearPlayback() {
    for (const source of this.playback) { source.stop(); source.disconnect(); }
    this.playback.clear();
    this.silentSeconds = 0;
    this.nextTime = 0;
  }
  close() {
    this.stopCapture();
    this.clearPlayback();
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") void context.close();
  }
}
