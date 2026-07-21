import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFirmware } from '../src/services/firmware-service.js';

const validSketch = `
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();
const uint8_t C_CHANNEL = 0;
const uint8_t E_CHANNEL = 4;
const uint8_t G_CHANNEL = 8;
#define SERVOMIN 150
#define SERVOMAX 600
const int REST_ANGLE = 0;
const int STRIKE_ANGLE = 90;
const int TEMPO_BPM = 120;
const int STRIKE_HOLD_MS = 60;
const int RETURN_SETTLE_MS = 40;
const int REPETITIONS = 3;
void setServoAngle(uint8_t channel, int angle) { pwm.setPWM(channel, 0, map(constrain(angle, 0, 180), 0, 180, SERVOMIN, SERVOMAX)); }
// Initialize the instrument and prepare all three notes at rest.
void setup() { Wire.begin(); pwm.begin(); pwm.setPWMFreq(50); setServoAngle(C_CHANNEL, REST_ANGLE); setServoAngle(E_CHANNEL, REST_ANGLE); setServoAngle(G_CHANNEL, REST_ANGLE); }
// Play a deterministic three-note melody forever.
void loop() { for (int i = 0; i < REPETITIONS; i++) { setServoAngle(C_CHANNEL, STRIKE_ANGLE); delay(60); setServoAngle(C_CHANNEL, REST_ANGLE); delay(60000 / TEMPO_BPM); } }
`;

test('accepts and normalizes a complete Aquatone sketch', () => {
  const result = validateFirmware(validSketch);
  assert.match(result, /#include <Adafruit_PWMServoDriver\.h>/);
  assert.ok(result.endsWith('\n'));
});

test('rejects Markdown code fences', () => {
  assert.throws(() => validateFirmware(`\`\`\`cpp\n${validSketch}\`\`\``), /Markdown/);
});

test('rejects sketches missing configurable constants', () => {
  assert.throws(() => validateFirmware(validSketch.replaceAll('G_CHANNEL', 'THIRD_CHANNEL')), /G_CHANNEL/);
});
