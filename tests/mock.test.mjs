import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket from 'ws';
process.env.TRANSLATION_PROVIDER = 'mock';
process.env.DEMO_PIN = '';
const { createTranslatorServer } = await import('../dist/server.js');
test('mock rooms still translate both directions without an API key', async t => {
  const { server, wss } = createTranslatorServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { for (const ws of wss.clients) ws.terminate(); await new Promise(resolve => server.close(resolve)); });
  for (const [language, text, expected] of [['pl','to jest test','Ceci est un test.'],['fr','ceci est un test','To jest test.']]) {
    const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
    await once(ws, 'open');
    const joined = new Promise(resolve => ws.on('message', raw => { if (JSON.parse(raw).type === 'joined') resolve(); }));
    ws.send(JSON.stringify({ type:'join', roomId:'test', language })); await joined;
    const translation = new Promise(resolve => ws.on('message', raw => { const m = JSON.parse(raw); if (m.type === 'translation') resolve(m); }));
    ws.send(JSON.stringify({ type:'source_text', text }));
    assert.equal((await translation).translatedText, expected);
    ws.close();
  }
});
