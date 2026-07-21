import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { getConfig } from '../config.js';
import { jobState } from './job-state.js';

function runCommand(args, timeoutMs) {
  const { arduinoCliPath } = getConfig();
  return new Promise((resolve, reject) => {
    jobState.log(`$ ${arduinoCliPath} ${args.join(' ')}`, 'command');
    const child = spawn(arduinoCliPath, args, { shell: false, windowsHide: true });
    let output = '';
    let settled = false;

    const timer = setTimeout(() => {
      child.kill();
      finish(new Error(`Arduino CLI timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(result);
    };

    const collect = (stream) => (chunk) => {
      const text = chunk.toString();
      output += text;
      for (const line of text.split(/\r?\n/).filter(Boolean)) jobState.log(line, stream);
    };
    child.stdout.on('data', collect('stdout'));
    child.stderr.on('data', collect('stderr'));
    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        const missing = new Error(`Arduino CLI was not found at "${arduinoCliPath}". Install it or update the path in Settings.`);
        missing.code = 'CLI_NOT_FOUND';
        finish(missing);
      } else finish(error);
    });
    child.on('close', (code) => {
      if (code === 0) finish(null, output);
      else {
        const error = new Error(`Arduino CLI exited with code ${code}.`);
        error.exitCode = code;
        error.output = output;
        finish(error);
      }
    });
  });
}

export async function compileFirmware() {
  const config = getConfig();
  await fs.rm(config.buildDir, { recursive: true, force: true });
  await fs.mkdir(config.buildDir, { recursive: true });
  return runCommand(['compile', '--fqbn', config.board, '--output-dir', config.buildDir, '--warnings', 'all', config.sketchDir], config.compileTimeoutMs);
}

export async function uploadFirmware() {
  const config = getConfig();
  if (!config.serialPort) {
    const error = new Error('No serial port is configured. Connect the Arduino and select its COM/serial port in Settings.');
    error.statusCode = 400;
    throw error;
  }
  return runCommand(['upload', '--fqbn', config.board, '--port', config.serialPort, '--input-dir', config.buildDir, config.sketchDir], config.uploadTimeoutMs);
}
