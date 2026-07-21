import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const initial = {
  port: positiveInteger(process.env.PORT, 3000),
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || '',
  model: process.env.OPENAI_MODEL?.trim() || 'gpt-5.6',
  arduinoCliPath: process.env.ARDUINO_CLI_PATH?.trim() || 'arduino-cli',
  board: process.env.ARDUINO_FQBN?.trim() || 'arduino:avr:uno',
  serialPort: process.env.ARDUINO_PORT?.trim() || '',
  openaiTimeoutMs: positiveInteger(process.env.OPENAI_TIMEOUT_MS, 90_000),
  compileTimeoutMs: positiveInteger(process.env.COMPILE_TIMEOUT_MS, 120_000),
  uploadTimeoutMs: positiveInteger(process.env.UPLOAD_TIMEOUT_MS, 60_000),
  reasoningEffort: process.env.OPENAI_REASONING_EFFORT?.trim() || 'low',
  rootDir,
  sketchDir: path.join(rootDir, 'firmware', 'generated', 'AquatoneRhythm'),
  buildDir: path.join(rootDir, 'firmware', 'build')
};

let runtime = { ...initial };

const allowedReasoning = new Set(['none', 'low', 'medium', 'high']);
const validators = {
  board: (value) => /^[A-Za-z0-9._-]+:[A-Za-z0-9._-]+:[A-Za-z0-9._-]+$/.test(value),
  serialPort: (value) => /^[A-Za-z0-9._:+\\/\-]+$/.test(value),
  model: (value) => /^[A-Za-z0-9._-]+$/.test(value),
  arduinoCliPath: (value) => !/[\0\r\n]/.test(value)
};

export function getConfig() {
  return { ...runtime };
}

export function getPublicSettings() {
  return {
    board: runtime.board,
    serialPort: runtime.serialPort,
    model: runtime.model,
    arduinoCliPath: runtime.arduinoCliPath,
    openaiTimeoutMs: runtime.openaiTimeoutMs,
    compileTimeoutMs: runtime.compileTimeoutMs,
    uploadTimeoutMs: runtime.uploadTimeoutMs,
    reasoningEffort: runtime.reasoningEffort,
    hasOpenaiApiKey: Boolean(runtime.openaiApiKey)
  };
}

export function updateSettings(input = {}) {
  const textFields = ['board', 'serialPort', 'model', 'arduinoCliPath'];
  for (const field of textFields) {
    if (input[field] === undefined) continue;
    if (typeof input[field] !== 'string' || !input[field].trim()) {
      throw new Error(`${field} must be a non-empty string.`);
    }
    const value = input[field].trim();
    if (!validators[field](value)) throw new Error(`${field} contains unsupported characters.`);
    runtime[field] = value;
  }

  if (input.openaiApiKey !== undefined && input.openaiApiKey !== '') {
    if (typeof input.openaiApiKey !== 'string' || !input.openaiApiKey.startsWith('sk-')) {
      throw new Error('OpenAI API key must begin with sk-.');
    }
    runtime.openaiApiKey = input.openaiApiKey.trim();
  }

  for (const field of ['openaiTimeoutMs', 'compileTimeoutMs', 'uploadTimeoutMs']) {
    if (input[field] === undefined) continue;
    const value = Number(input[field]);
    if (!Number.isInteger(value) || value < 1_000 || value > 600_000) {
      throw new Error(`${field} must be between 1000 and 600000 milliseconds.`);
    }
    runtime[field] = value;
  }

  if (input.reasoningEffort !== undefined) {
    if (!allowedReasoning.has(input.reasoningEffort)) throw new Error('Unsupported reasoning effort.');
    runtime.reasoningEffort = input.reasoningEffort;
  }
  return getPublicSettings();
}

export function resetConfigForTests() {
  runtime = { ...initial };
}
