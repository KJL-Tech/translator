// AudioWorklet keeps capture running independently from UI rendering.
class TranslatorCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(Math.round(sampleRate / 5));
    this.offset = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const sample of input) {
      this.samples[this.offset++] = sample;
      if (this.offset === this.samples.length) {
        const buffer = new ArrayBuffer(9600);
        const view = new DataView(buffer);
        const ratio = this.samples.length / 4800;
        for (let i = 0; i < 4800; i++) {
          const position = i * ratio;
          const left = Math.floor(position);
          const weight = position - left;
          const value = this.samples[left] * (1 - weight) + this.samples[Math.min(left + 1, this.samples.length - 1)] * weight;
          const clamped = Math.max(-1, Math.min(1, value));
          view.setInt16(i * 2, Math.round(clamped * (clamped < 0 ? 32768 : 32767)), true);
        }
        this.port.postMessage(buffer, [buffer]);
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor("translator-capture", TranslatorCapture);
