import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

test('GET /status returns the job state', async () => {
  const response = await request(app).get('/status').expect(200);
  assert.equal(typeof response.body.status, 'string');
  assert.equal(typeof response.body.busy, 'boolean');
});

test('POST /generate validates short prompts before contacting OpenAI', async () => {
  const response = await request(app).post('/generate').send({ prompt: 'x' }).expect(400);
  assert.match(response.body.error, /between 3 and 1000/);
});

test('settings never expose the API key', async () => {
  const response = await request(app).get('/settings').expect(200);
  assert.equal(response.body.openaiApiKey, undefined);
  assert.equal(typeof response.body.hasOpenaiApiKey, 'boolean');
});

test('settings reject shell metacharacters', async () => {
  const response = await request(app).put('/settings').send({ board: 'arduino:avr:uno; bad' }).expect(400);
  assert.match(response.body.error, /unsupported characters/);
});

test('settings allow a Windows CLI path containing spaces', async () => {
  const response = await request(app).put('/settings').send({ arduinoCliPath: 'C:\\Program Files\\Arduino CLI\\arduino-cli.exe' }).expect(200);
  assert.equal(response.body.arduinoCliPath, 'C:\\Program Files\\Arduino CLI\\arduino-cli.exe');
});

test('upload is blocked until a successful compile', async () => {
  const response = await request(app).post('/upload').send({}).expect(409);
  assert.match(response.body.error, /Compile/);
});
