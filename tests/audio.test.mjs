import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

test('microphone worklet emits continuous 200ms PCM16 at 24kHz, including silence', () => {
  for (const rate of [24000, 44100, 48000]) {
    let Processor;
    const output = [];
    const context = vm.createContext({ sampleRate: rate, Float32Array, ArrayBuffer, DataView,
      AudioWorkletProcessor: class { port = { postMessage: buffer => output.push(buffer) }; },
      registerProcessor: (_name, klass) => { Processor = klass; },
    });
    vm.runInContext(fs.readFileSync(new URL('../public/capture-worklet.js', import.meta.url), 'utf8'), context);
    const processor = new Processor();
    const input = new Float32Array(rate);
    for (let offset = 0; offset < input.length; offset += 128) processor.process([[input.subarray(offset, offset + 128)]]);
    assert.equal(output.length, 5);
    for (const buffer of output) { assert.equal(buffer.byteLength, 9600); assert.equal(new DataView(buffer).getInt16(0, true), 0); }
  }
});

test('worklet encodes clipped signed PCM in little-endian order', () => {
  let Processor; let result;
  const context = vm.createContext({ sampleRate: 24000, Float32Array, ArrayBuffer, DataView,
    AudioWorkletProcessor: class { port = { postMessage: buffer => { result = new DataView(buffer); } }; },
    registerProcessor: (_name, klass) => { Processor = klass; },
  });
  vm.runInContext(fs.readFileSync(new URL('../public/capture-worklet.js', import.meta.url), 'utf8'), context);
  const input = new Float32Array(4800).fill(2); input[0] = -2;
  new Processor().process([[input]]);
  assert.equal(result.getInt16(0, true), -32768);
  assert.equal(result.getInt16(2, true), 32767);
});


test('long silent output does not delay the next spoken translation', async () => {
  const { OpenAIAudio } = await import('../public/openai-audio.js');
  const errors = []; const played = [];
  const audio = new OpenAIAudio(() => {}, error => errors.push(error));
  audio.context = {
    state: 'running', currentTime: 0, destination: {},
    createBuffer: (_, size, rate) => {
      const samples = new Float32Array(size);
      return { duration: size/rate, getChannelData: () => samples };
    },
    createBufferSource: () => ({ connect() {}, disconnect() {}, stop() {}, start(time) { played.push({ time, buffer: this.buffer }); } }),
  };
  const voice = Buffer.alloc(19200); voice.writeInt16LE(20, 100);
  audio.play(voice.toString('base64'));
  for (let i = 0; i < 60; i++) audio.play(Buffer.alloc(19200).toString('base64'));
  audio.play(voice.toString('base64'));
  assert.deepEqual(errors, []);
  assert.equal(played.length, 3);
  assert.ok(played[2].time < 1);
  assert.equal(played[2].buffer.getChannelData(0)[50], 20/32768);
  audio.clearPlayback();
  assert.equal(audio.silentSeconds, 0);
});
