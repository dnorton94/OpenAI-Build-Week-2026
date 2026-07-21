import OpenAI from 'openai';
import { getConfig } from '../config.js';
import { validateFirmware } from './firmware-service.js';

export const SYSTEM_PROMPT = `You generate production-ready Arduino firmware for Aquatone, a three-note robotic glass instrument. Translate the requested song, melody, mood, or rhythm into playable note events for the exact hardware described below.

Return only raw Arduino source code. Never return Markdown. Never wrap code in code fences. Never include explanations outside source comments. Always generate one complete compilable sketch that needs no editing.

Exact hardware:
- One PCA9685 board driven with Wire.h and Adafruit_PWMServoDriver.h.
- Three SG90 servos strike three tuned glasses: note C is PCA9685 channel 0, note E is channel 4, and note G is channel 8.
- Each servo rests at 0 degrees and rotates clockwise to 90 degrees to strike its glass, then returns to 0 degrees.
- The known-good pulse range is SERVOMIN 150 and SERVOMAX 600, with the PCA9685 running at 50 Hz.

Hard requirements:
- Include <Wire.h> and <Adafruit_PWMServoDriver.h>, instantiate Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver(), call Wire.begin(), pwm.begin(), and pwm.setPWMFreq(50).
- Declare configurable constants named C_CHANNEL = 0, E_CHANNEL = 4, G_CHANNEL = 8, SERVOMIN = 150, SERVOMAX = 600, REST_ANGLE = 0, STRIKE_ANGLE = 90, TEMPO_BPM, STRIKE_HOLD_MS, RETURN_SETTLE_MS, and REPETITIONS.
- Provide a safe setServoAngle(uint8_t channel, int angle) helper that constrains angles to 0..180, maps them from SERVOMIN to SERVOMAX, and calls pwm.setPWM(channel, 0, pulse).
- Model the melody as deterministic static note-event data in program memory. Events may play C, E, G, a rest, or a simultaneous combination of C/E/G. Store rhythmic duration separately from note choice so tempo is configurable.
- Since the physical instrument has only C, E, and G, approximate unavailable pitches using the closest musically appropriate available note or a rest. Never address any motor channel other than 0, 4, and 8.
- Make named melodies recognizable primarily through their rhythm and contour. Mood prompts should produce a tasteful original pattern using only C, E, and G.
- For every event, strike only the requested note motors: move from REST_ANGLE to STRIKE_ANGLE, hold for STRIKE_HOLD_MS, return to REST_ANGLE, then wait for the remainder of the event duration. Rest events only wait.
- Return all three motors to REST_ANGLE in setup() and after the melody.
- Begin playing automatically after power-on/upload and repeat the complete melody according to REPETITIONS, with a clear pause between repetitions.
- Use clean AVR-compatible C++, comments explaining the hardware map and melody, and no dynamic memory, String, serial input, networking, or runtime host commands.
- Do not use the Arduino Servo library. The only non-core library permitted is Adafruit PWM Servo Driver Library.
- The result must compile for Arduino Uno without modification once Adafruit PWM Servo Driver Library is installed.`;

export async function generateFirmware(prompt) {
  const config = getConfig();
  if (!config.openaiApiKey) {
    const error = new Error('OpenAI API key is missing. Add it in Settings or the OPENAI_API_KEY environment variable.');
    error.statusCode = 400;
    throw error;
  }

  const client = new OpenAI({ apiKey: config.openaiApiKey, timeout: config.openaiTimeoutMs, maxRetries: 2 });
  let response;
  try {
    response = await client.responses.create({
      model: config.model,
      instructions: SYSTEM_PROMPT,
      input: `Compose and implement this request for the three-glass C/E/G instrument: ${prompt}`,
      reasoning: { effort: config.reasoningEffort },
      max_output_tokens: 8000
    });
  } catch (error) {
    const wrapped = new Error(error?.message || 'OpenAI could not generate firmware.');
    wrapped.statusCode = error?.status || (error?.name === 'APIConnectionTimeoutError' ? 504 : 502);
    throw wrapped;
  }

  if (response.status === 'incomplete') throw new Error(`OpenAI response was incomplete (${response.incomplete_details?.reason || 'unknown reason'}).`);
  try {
    return validateFirmware(response.output_text || '');
  } catch (error) {
    error.statusCode = 502;
    throw error;
  }
}
