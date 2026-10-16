import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import WebSocket, { WebSocketServer } from 'ws';
process.env.TRANSLATION_PROVIDER = 'openai';
process.env.DEMO_PIN = 'test-pin';
process.env.OPENAI_API_KEY = '';
const { createTranslatorServer } = await import('../dist/server.js');
const { OpenAITranslationSession } = await import('../dist/openaiTranslation.js');

const pcm = Buffer.alloc(9600).toString('base64');
function inbox(socket) {
  const messages = [];
  socket.on('message', raw => messages.push(JSON.parse(raw.toString())));
  return {
    messages,
    async take(type, predicate = () => true) {
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        const index = messages.findIndex(message => message.type === type && predicate(message));
        if (index >= 0) return messages.splice(index, 1)[0];
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      throw Error('Missing message ' + type + ': ' + JSON.stringify(messages));
    },
  };
}
async function fixture(t, options = {}) {
  const upstream = new WebSocketServer({ port: 0 });
  await once(upstream, 'listening');
  const targets = [];
  const inputs = [];
  const updates = [];
  upstream.on('connection', ws => {
    ws.send(JSON.stringify({ type: 'session.created' }));
    ws.on('message', raw => {
      const event = JSON.parse(raw.toString());
      if (event.type === 'session.update') {
        updates.push(event);
        targets.push(event.session.audio.output.language);
        ws.send(JSON.stringify({ type: 'session.updated' }));
      }
      if (event.type === 'session.input_audio_buffer.append') {
        inputs.push(event);
        ws.send(JSON.stringify({ type: 'session.output_transcript.delta', delta: 'Bonjour' }));
        ws.send(JSON.stringify({ type: 'session.output_transcript.delta', delta: ' !' }));
        ws.send(JSON.stringify({ type: 'session.output_audio.delta', delta: pcm, sample_rate: 24000, channels: 1, format: 'pcm16' }));
      }
      if (event.type === 'session.close') {
        ws.send(JSON.stringify({ type: 'session.output_transcript.delta', delta: ' fin' }));
        ws.send(JSON.stringify({ type: 'session.closed' }));
      }
    });
  });
  const connections = [];
  const factory = (target, callbacks) => new OpenAITranslationSession(target, callbacks, {
    apiKey: 'test-not-a-real-key', maxSeconds: options.maxSeconds ?? 300, transcription: false,
    connect: () => { const ws = new WebSocket(`ws://127.0.0.1:${upstream.address().port}`); connections.push(ws); return ws; },
  });
  const { server, wss } = createTranslatorServer(options.missingKey ? undefined : factory);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  t.after(async () => {
    for (const ws of wss.clients) ws.terminate();
    for (const ws of upstream.clients) ws.terminate();
    for (const ws of connections) ws.terminate();
    await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => upstream.close(resolve))]);
  });
  async function client(language, roomId = 'demo', pin = 'test-pin') {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const box = inbox(ws);
    await once(ws, 'open');
    const send = data => ws.send(JSON.stringify(data));
    send({ type: 'join', language, roomId, demoPin: pin });
    return { ws, send, ...box };
  }
  return { client, port, targets, inputs, updates, upstream };
}

test('both language directions: PCM reaches only the other participant; captions preserve deltas', async t => {
  const f = await fixture(t);
  const pl = await f.client('pl'); const plJoin = await pl.take('joined');
  const fr = await f.client('fr'); await fr.take('joined');
  const outsider = await f.client('pl', 'private'); await outsider.take('joined');
  pl.send({ type: 'openai_start' }); const plSession = await pl.take('openai_started');
  fr.send({ type: 'openai_start' }); const frSession = await fr.take('openai_started');
  assert.deepEqual(f.targets, ['fr', 'pl']);
  assert.equal(f.updates[0].session.audio.input.transcription, null);
  pl.send({ type: 'openai_audio', sessionId: plSession.sessionId, audio: pcm });
  const audio = await fr.take('openai_delta', m => m.kind === 'audio');
  assert.equal(audio.speakerId, plJoin.clientId); assert.equal(audio.targetLanguage, 'fr');
  const first = await fr.take('openai_delta', m => m.kind === 'translation');
  const second = await fr.take('openai_delta', m => m.kind === 'translation');
  assert.equal(first.delta + second.delta, 'Bonjour !');
  assert.equal(pl.messages.some(m => m.kind === 'audio'), false);
  assert.equal(outsider.messages.some(m => m.type === 'openai_delta'), false);
  fr.send({ type: 'openai_audio', sessionId: frSession.sessionId, audio: pcm });
  assert.equal((await pl.take('openai_delta', m => m.kind === 'audio')).targetLanguage, 'pl');
  pl.send({ type: 'openai_stop' });
  const stopped = await pl.take('openai_stopped');
  assert.equal(stopped.seconds, 0.2);
  assert.ok(Math.abs(stopped.estimatedUsd - 0.2 / 60 * 0.034) < 1e-9);
  assert.equal((await fr.take('openai_delta', m => m.delta === ' fin')).kind, 'translation');
});

test('PIN, peer presence, two-person room and duplicate starts are enforced', async t => {
  const f = await fixture(t);
  const bad = await f.client('pl', 'demo', 'wrong'); assert.equal((await bad.take('error')).code, 'invalid_demo_pin');
  const pl = await f.client('pl'); await pl.take('joined');
  pl.send({ type: 'openai_start' }); assert.equal((await pl.take('error')).code, 'peer_required');
  const duplicate = await f.client('pl'); assert.equal((await duplicate.take('error')).code, 'room_full');
  const fr = await f.client('fr'); await fr.take('joined');
  pl.send({ type: 'openai_start' }); await pl.take('openai_started');
  pl.send({ type: 'openai_start' }); assert.equal((await pl.take('error')).code, 'session_active');
  assert.equal(f.targets.length, 1);
});

test('leaving stops the remaining speaker session', async t => {
  const f = await fixture(t);
  const pl = await f.client('pl'); await pl.take('joined');
  const fr = await f.client('fr'); await fr.take('joined');
  pl.send({ type: 'openai_start' }); await pl.take('openai_started');
  fr.ws.close();
  assert.equal((await pl.take('openai_stopped')).reason, 'peer_left');
});

test('server time limit stops an idle session without client cooperation', async t => {
  const f = await fixture(t, { maxSeconds: 0.05 });
  const pl = await f.client('pl'); await pl.take('joined');
  const fr = await f.client('fr'); await fr.take('joined');
  pl.send({ type: 'openai_start' }); await pl.take('openai_started');
  assert.equal((await pl.take('openai_stopped')).reason, 'time_limit');
});

test('missing key is actionable and does not create an upstream connection', async t => {
  const f = await fixture(t, { missingKey: true });
  const pl = await f.client('pl'); await pl.take('joined');
  const fr = await f.client('fr'); await fr.take('joined');
  pl.send({ type: 'openai_start' });
  assert.equal((await pl.take('error')).code, 'missing_openai_key');
  assert.equal((await pl.take('openai_stopped')).estimatedUsd, 0);
  const health = await (await fetch(`http://127.0.0.1:${f.port}/api/health`)).json();
  assert.equal(health.hasOpenAIKey, false);
  assert.equal(JSON.stringify(health).includes('test-not-a-real-key'), false);
});

test('malformed audio closes upstream instead of sending corrupted data', async t => {
  const f = await fixture(t);
  const pl = await f.client('pl'); await pl.take('joined');
  const fr = await f.client('fr'); await fr.take('joined');
  pl.send({ type: 'openai_start' }); const session = await pl.take('openai_started');
  pl.send({ type: 'openai_audio', sessionId: session.sessionId, audio: 'not PCM' });
  assert.equal((await pl.take('error')).code, 'invalid_audio');
  await pl.take('openai_stopped'); assert.equal(f.inputs.length, 0);
});

test('upstream errors are sanitized and stop the session', async t => {
  const f = await fixture(t);
  const pl = await f.client('pl'); await pl.take('joined');
  const fr = await f.client('fr'); await fr.take('joined');
  pl.send({ type: 'openai_start' }); await pl.take('openai_started');
  [...f.upstream.clients][0].send(JSON.stringify({ type: 'error', error: { message: 'secret-key-do-not-leak' } }));
  const error = await pl.take('error');
  assert.equal(error.code, 'openai_rejected'); assert.ok(!JSON.stringify(error).includes('secret-key'));
  await pl.take('openai_stopped');
});

test('two active sessions prevent a third paid connection', async t => {
  const f = await fixture(t);
  const pl = await f.client('pl'); await pl.take('joined');
  const fr = await f.client('fr'); await fr.take('joined');
  const otherPl = await f.client('pl','other'); await otherPl.take('joined');
  const otherFr = await f.client('fr','other'); await otherFr.take('joined');
  pl.send({type:'openai_start'}); await pl.take('openai_started');
  fr.send({type:'openai_start'}); await fr.take('openai_started');
  otherPl.send({type:'openai_start'});
  assert.equal((await otherPl.take('error')).code,'server_busy');
  assert.equal(f.targets.length,2);
});

test('speaker state is shared and resets after Stop', async t => {
  const f = await fixture(t);
  const pl = await f.client('pl'); const joined=await pl.take('joined');
  const fr = await f.client('fr'); await fr.take('joined');
  pl.send({type:'openai_start'}); await pl.take('openai_started');
  const active=await fr.take('presence',m=>m.room.members?.some(member=>member.id===joined.clientId && member.speaking));
  assert.equal(active.room.members.length,2);
  fr.messages.length=0;
  pl.send({type:'openai_stop'});
  await fr.take('presence',m=>m.room.members?.every(member=>!member.speaking));
  await pl.take('openai_stopped');
});

test('failed access codes are rate limited across sockets', async t => {
  const f = await fixture(t);
  const bad = await f.client('pl','demo','wrong'); await bad.take('error');
  for(let i=0;i<9;i++) {bad.send({type:'join',roomId:'demo',language:'pl',demoPin:'wrong'});assert.equal((await bad.take('error')).code,'invalid_demo_pin');}
  const retry = await f.client('pl','demo','test-pin');
  assert.equal((await retry.take('error')).code,'too_many_attempts');
});

test('aggregate audio allowance stops sessions and prevents further starts', async t => {
  const {config}=await import('../dist/config.js');
  const previous=config.maxTotalAudioSeconds;
  config.maxTotalAudioSeconds=0.4;
  t.after(()=>{config.maxTotalAudioSeconds=previous;});
  const f = await fixture(t);
  const pl = await f.client('pl'); await pl.take('joined');
  const fr = await f.client('fr'); await fr.take('joined');
  pl.send({type:'openai_start'}); const session=await pl.take('openai_started');
  for(let i=0;i<3;i++)pl.send({type:'openai_audio',sessionId:session.sessionId,audio:pcm});
  assert.equal((await pl.take('openai_stopped')).reason,'budget_limit');
  assert.equal(f.inputs.length,2);
  pl.send({type:'openai_start'}); assert.equal((await pl.take('error')).code,'budget_limit');
});

test('public responses block framing and private files are not served', async t => {
  const f = await fixture(t);
  const response=await fetch(`http://127.0.0.1:${f.port}/`);
  assert.equal(response.headers.get('x-frame-options'),'DENY');
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.ok(response.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  const env=await fetch(`http://127.0.0.1:${f.port}/.env`);
  assert.ok(!(await env.text()).includes('OPENAI_API_KEY='));
});
