import { Router } from 'express';
import { generateFirmware } from '../services/openai-service.js';
import { saveFirmware } from '../services/firmware-service.js';
import { compileFirmware, uploadFirmware } from '../services/arduino-service.js';
import { jobState } from '../services/job-state.js';
import { getPublicSettings, updateSettings } from '../config.js';

export const apiRouter = Router();

apiRouter.post('/generate', async (req, res, next) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (prompt.length < 3 || prompt.length > 1000) return res.status(400).json({ error: 'Prompt must be between 3 and 1000 characters.' });
    const result = await jobState.runExclusive(async () => {
      jobState.clearLogs();
      jobState.set('generating', 'AI is arranging your melody for C, E, and G');
      jobState.log(`Generating firmware for: ${prompt}`);
      try {
        const code = await generateFirmware(prompt);
        const saved = await saveFirmware(code);
        jobState.log('Complete Arduino sketch generated and validated.', 'success');
        jobState.set('ready', 'Firmware is ready to review');
        return saved;
      } catch (error) {
        jobState.log(error.message, 'stderr');
        jobState.set('error', error.message);
        throw error;
      }
    });
    res.json({ code: result.code, status: jobState.snapshot() });
  } catch (error) { next(error); }
});

apiRouter.post('/compile', async (req, res, next) => {
  try {
    const result = await jobState.runExclusive(async () => {
      jobState.clearLogs();
      jobState.set('compiling', 'Compiling Arduino firmware');
      try {
        if (req.body?.code !== undefined) await saveFirmware(req.body.code);
        const output = await compileFirmware();
        jobState.log('Compilation completed successfully.', 'success');
        jobState.set('compiled', 'Compilation succeeded');
        return output;
      } catch (error) {
        jobState.log(error.message, 'stderr');
        jobState.set('error', error.message);
        throw error;
      }
    });
    res.json({ success: true, output: result, status: jobState.snapshot() });
  } catch (error) { next(error); }
});

apiRouter.post('/upload', async (_req, res, next) => {
  try {
    if (jobState.status !== 'compiled') return res.status(409).json({ error: 'Compile the firmware successfully before uploading.' });
    const result = await jobState.runExclusive(async () => {
      jobState.set('uploading', 'Uploading firmware to Arduino');
      try {
        const output = await uploadFirmware();
        jobState.log('Upload complete. Aquatone is now playing.', 'success');
        jobState.set('running', 'Rhythm is running on the Arduino');
        return output;
      } catch (error) {
        jobState.log(error.message, 'stderr');
        jobState.set('error', error.message);
        throw error;
      }
    });
    res.json({ success: true, output: result, status: jobState.snapshot() });
  } catch (error) { next(error); }
});

apiRouter.get('/status', (_req, res) => res.json(jobState.snapshot()));
apiRouter.get('/logs', (_req, res) => res.json({ logs: jobState.logs }));
apiRouter.get('/settings', (_req, res) => res.json(getPublicSettings()));
apiRouter.put('/settings', (req, res, next) => {
  try { res.json(updateSettings(req.body)); } catch (error) { error.statusCode = 400; next(error); }
});

apiRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('status', jobState.snapshot());
  for (const entry of jobState.logs) send('log', entry);
  const onStatus = (data) => send('status', data);
  const onLog = (data) => send('log', data);
  const onClear = () => send('clear', {});
  jobState.on('status', onStatus);
  jobState.on('log', onLog);
  jobState.on('clear', onClear);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    jobState.off('status', onStatus);
    jobState.off('log', onLog);
    jobState.off('clear', onClear);
  });
});
