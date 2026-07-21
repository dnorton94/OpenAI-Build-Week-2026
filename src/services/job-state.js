import { EventEmitter } from 'node:events';

const VALID_STATES = new Set(['idle', 'generating', 'ready', 'compiling', 'compiled', 'uploading', 'running', 'error']);

export class JobState extends EventEmitter {
  constructor() {
    super();
    this.status = 'idle';
    this.message = 'Describe a melody to begin';
    this.logs = [];
    this.busy = false;
    this.updatedAt = new Date().toISOString();
  }

  set(status, message) {
    if (!VALID_STATES.has(status)) throw new Error(`Invalid status: ${status}`);
    this.status = status;
    this.message = message;
    this.updatedAt = new Date().toISOString();
    this.emit('status', this.snapshot());
  }

  log(message, stream = 'info') {
    const entry = { id: Date.now() + Math.random(), timestamp: new Date().toISOString(), stream, message: String(message) };
    this.logs.push(entry);
    if (this.logs.length > 500) this.logs.shift();
    this.emit('log', entry);
    return entry;
  }

  clearLogs() {
    this.logs = [];
    this.emit('clear');
  }

  snapshot() {
    return { status: this.status, message: this.message, busy: this.busy, updatedAt: this.updatedAt };
  }

  async runExclusive(fn) {
    if (this.busy) {
      const error = new Error('Aquatone is already processing another operation.');
      error.statusCode = 409;
      throw error;
    }
    this.busy = true;
    try {
      return await fn();
    } finally {
      this.busy = false;
      this.updatedAt = new Date().toISOString();
      this.emit('status', this.snapshot());
    }
  }
}

export const jobState = new JobState();
