import fs from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from '../config.js';

const REQUIRED_PATTERNS = [
  [/#include\s*<Wire\.h>/, 'include the Wire library'],
  [/#include\s*<Adafruit_PWMServoDriver\.h>/, 'include the Adafruit PWM Servo Driver library'],
  [/\bAdafruit_PWMServoDriver\b/, 'create an Adafruit PWM servo driver'],
  [/\bvoid\s+setup\s*\(\s*\)/, 'define setup()'],
  [/\bvoid\s+loop\s*\(\s*\)/, 'define loop()'],
  [/\bC_CHANNEL\b\s*=\s*0\b/, 'map C_CHANNEL to channel 0'],
  [/\bE_CHANNEL\b\s*=\s*4\b/, 'map E_CHANNEL to channel 4'],
  [/\bG_CHANNEL\b\s*=\s*8\b/, 'map G_CHANNEL to channel 8'],
  [/\bSERVOMIN\b(?:\s*=|\s+)\s*150\b/, 'set SERVOMIN to 150'],
  [/\bSERVOMAX\b(?:\s*=|\s+)\s*600\b/, 'set SERVOMAX to 600'],
  [/\bREST_ANGLE\b\s*=\s*0\b/, 'set REST_ANGLE to 0 degrees'],
  [/\bSTRIKE_ANGLE\b\s*=\s*90\b/, 'set STRIKE_ANGLE to 90 degrees'],
  [/\bTEMPO_BPM\b/, 'define TEMPO_BPM'],
  [/\bSTRIKE_HOLD_MS\b/, 'define STRIKE_HOLD_MS'],
  [/\bRETURN_SETTLE_MS\b/, 'define RETURN_SETTLE_MS'],
  [/\bREPETITIONS\b/, 'define REPETITIONS'],
  [/\bsetServoAngle\s*\(/, 'define setServoAngle()'],
  [/\bWire\.begin\s*\(/, 'initialize Wire'],
  [/\bpwm\.begin\s*\(/, 'initialize the PWM driver'],
  [/setPWMFreq\s*\(\s*50\s*\)/, 'set the PWM frequency to 50 Hz']
];

export function validateFirmware(code) {
  if (typeof code !== 'string' || code.trim().length < 180) throw new Error('The AI returned an empty or incomplete sketch.');
  if (/```|^\s*#{1,6}\s/m.test(code)) throw new Error('The AI response contained Markdown instead of raw Arduino source code.');
  if (/#include\s*<Servo\.h>/.test(code)) throw new Error('The generated sketch used Servo.h instead of the PCA9685 driver.');
  if (code.length > 100_000) throw new Error('The generated sketch is unexpectedly large.');
  const missing = REQUIRED_PATTERNS.filter(([pattern]) => !pattern.test(code)).map(([, label]) => label);
  if (missing.length) throw new Error(`The generated sketch must ${missing.join(', ')}.`);
  return code.trim() + '\n';
}

export async function saveFirmware(code) {
  const validated = validateFirmware(code);
  const { sketchDir } = getConfig();
  await fs.mkdir(sketchDir, { recursive: true });
  const sketchPath = path.join(sketchDir, 'AquatoneRhythm.ino');
  await fs.writeFile(sketchPath, validated, 'utf8');
  return { code: validated, sketchPath };
}

export async function readFirmware() {
  const { sketchDir } = getConfig();
  return fs.readFile(path.join(sketchDir, 'AquatoneRhythm.ino'), 'utf8');
}
