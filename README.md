# Aquatone

Aquatone is a local full-stack application that turns a natural-language melody request into Arduino firmware for a three-note robotic glass instrument. GPT-5.6 arranges the request for the available C, E, and G glasses, the user reviews the generated sketch, and Arduino CLI compiles and uploads it to the board.

After upload, the Arduino performs independently. Aquatone does not send runtime commands over the serial port.

## How it works

1. Enter a request such as `Play Happy Birthday` or `Create a slow relaxing melody`.
2. The Node.js backend asks GPT-5.6 for a complete Arduino `.ino` sketch.
3. Aquatone validates the hardware mappings and displays the editable sketch.
4. **Compile & Upload** compiles the reviewed code with Arduino CLI.
5. If compilation succeeds, Aquatone flashes the connected Arduino.
6. The three servo-driven strikers play the generated melody automatically.

## Hardware

You will need:

- An Arduino Uno or compatible AVR board
- One PCA9685 16-channel PWM servo driver
- Three SG90 servos
- Three glasses tuned to C, E, and G
- A regulated 5 V supply capable of powering all three servos
- Jumper wires and a USB data cable

### Note and motor mapping

Generated firmware always uses this mapping:

| Note | Musical role | PCA9685 channel | Rest angle | Strike angle |
| --- | --- | ---: | ---: | ---: |
| C | Root | 0 | 0 degrees | 90 degrees clockwise |
| E | Major third | 4 | 0 degrees | 90 degrees clockwise |
| G | Perfect fifth | 8 | 0 degrees | 90 degrees clockwise |

The pulse range is 150 to 600 at 50 Hz. Because the instrument only contains C, E, and G, GPT-5.6 approximates unavailable pitches with the nearest useful note or a rest. Recognisable songs rely on rhythm and melodic contour as well as pitch.

Every generated hit must be a complete mechanical cycle: all strikers start at 0 degrees, the selected note motor moves to 90 degrees, and all strikers return to 0 degrees before the next event begins. This keeps the instrument ready for repeated notes and prevents a striker from staying raised after a hit.

### Wiring

| Arduino Uno | PCA9685 |
| --- | --- |
| 5 V | VCC (logic power) |
| GND | GND |
| A4 / SDA | SDA |
| A5 / SCL | SCL |

Connect the three servo signal leads to PCA9685 channels 0, 4, and 8. Connect servo power to the PCA9685 `V+` terminal using the external regulated 5 V supply.

Do not power all three servos from the Arduino 5 V pin. Connect the external supply ground, PCA9685 ground, and Arduino ground together. Test mechanical clearance carefully before uploading firmware because each striker moves from 0 to 90 degrees.

## Software prerequisites

Install these before cloning or running Aquatone:

- [Git](https://git-scm.com/downloads)
- [Node.js 20 or newer](https://nodejs.org/)
- [Arduino CLI](https://arduino.github.io/arduino-cli/latest/installation/)
- An [OpenAI API key](https://platform.openai.com/api-keys) with access to the configured model

Check the installations:

```bash
git --version
node --version
npm --version
arduino-cli version
```

Node must report version 20 or newer.

## Local installation

### 1. Clone the repository

Copy the repository URL from GitHub, then run:

```bash
git clone <repository-url>
cd aquatone
```

If you downloaded a ZIP instead, extract it and open a terminal inside the extracted project directory.

### 2. Install Node.js dependencies

```bash
npm ci
```

`npm ci` installs the exact dependency versions recorded in `package-lock.json`. The generated `node_modules` directory is intentionally excluded from Git and should not be uploaded to GitHub.

The main application dependencies are:

- Express for the local web server and API
- OpenAI's Node.js SDK for GPT-5.6 requests
- dotenv for local environment configuration
- Supertest for API tests

### 3. Install the Arduino board core and library

For an Arduino Uno:

```bash
arduino-cli core update-index
arduino-cli core install arduino:avr
arduino-cli lib install "Adafruit PWM Servo Driver Library"
```

The Adafruit installation resolves its supporting BusIO dependency. Generated firmware uses the Arduino core `Wire.h` library and Adafruit's `Adafruit_PWMServoDriver.h`. It does not use `Servo.h`.

Verify the installation:

```bash
arduino-cli core list
arduino-cli lib list
```

You should see `arduino:avr` and `Adafruit PWM Servo Driver Library` in the output.

### 4. Connect and identify the Arduino

Connect the board using a USB data cable, then run:

```bash
arduino-cli board list
```

Note the board's port. Typical examples are:

- Windows: `COM3`
- macOS: `/dev/cu.usbmodem...`
- Linux: `/dev/ttyACM0`

The default board identifier for an Arduino Uno is `arduino:avr:uno`.

### 5. Configure environment variables

Create a private `.env` file from the supplied example.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS or Linux:

```bash
cp .env.example .env
```

Open `.env` and configure it:

```dotenv
PORT=3000
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-5.6
ARDUINO_CLI_PATH=arduino-cli
ARDUINO_FQBN=arduino:avr:uno
ARDUINO_PORT=COM3
OPENAI_TIMEOUT_MS=90000
COMPILE_TIMEOUT_MS=300000
UPLOAD_TIMEOUT_MS=60000
```

Replace `COM3` with the port reported by `arduino-cli board list`. If Arduino CLI is not on your system `PATH`, set `ARDUINO_CLI_PATH` to its full executable path.

Never commit or upload `.env`. It contains your OpenAI API key and is already excluded by `.gitignore`.

Settings can also be changed from the Aquatone interface. An API key entered there remains in server memory for the current run and is never returned to the browser.

## Run Aquatone

Start the normal local server:

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

For development with automatic server restart:

```bash
npm run dev
```

To stop the server, press `Ctrl+C` in its terminal.

## Generate and upload a melody

1. Open Settings and confirm the board type, serial port, API key, and model.
2. Enter a melody request and select **Generate Firmware**.
3. Review the generated channel mapping, note events, angles, and timing.
4. Make any desired edits directly in the code editor.
5. Ensure nothing else, including Arduino Serial Monitor, is using the board's port.
6. Select **Compile & Upload**.
7. Watch the live console for compilation and upload progress.

Aquatone only uploads after a successful compilation. The board begins playing after it resets. Each note event should visibly return the striker to 0 degrees before the next note is played.

## Tests

Run all automated tests:

```bash
npm test
```

Run the server syntax check and test suite together:

```bash
npm run check
```

## Available npm commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install locked project dependencies |
| `npm start` | Start Aquatone normally |
| `npm run dev` | Start with Node's file watcher |
| `npm test` | Run automated tests |
| `npm run check` | Syntax-check the server and run tests |

## Project structure

```text
public/                           Browser interface and live status UI
src/app.js                        Express application setup
src/config.js                     Environment and runtime settings
src/server.js                     Local server entry point
src/routes/api.js                 Generation, compile, upload, and event routes
src/services/openai-service.js    GPT-5.6 firmware generation contract
src/services/firmware-service.js  Sketch validation and persistence
src/services/arduino-service.js   Arduino CLI compile and upload processes
src/services/job-state.js         Workflow status and bounded live logs
test/                             Automated service and API tests
firmware/generated/               Generated sketch; created at runtime and ignored
firmware/build/                   Compiler output; created at runtime and ignored
```

## API endpoints

| Endpoint | Purpose |
| --- | --- |
| `POST /generate` | Generate and validate firmware from a natural-language prompt |
| `POST /compile` | Save the reviewed sketch and compile it |
| `POST /upload` | Upload the most recent successful build |
| `GET /status` | Return the current workflow state |
| `GET /logs` | Return recent structured logs |
| `GET /events` | Stream status and logs using Server-Sent Events |
| `GET /settings` | Return non-secret runtime settings |
| `PUT /settings` | Update runtime settings |

## Troubleshooting

### `arduino-cli` is not recognised or was not found

Run `arduino-cli version`. Add Arduino CLI to your `PATH`, or enter its full executable path in `.env` or Aquatone Settings.

### Arduino AVR platform is missing

```bash
arduino-cli core update-index
arduino-cli core install arduino:avr
```

### `Adafruit_PWMServoDriver.h: No such file or directory`

```bash
arduino-cli lib install "Adafruit PWM Servo Driver Library"
```

### No board appears

- Try another USB cable; some cables provide power but no data.
- Try another USB port.
- Install the USB driver required by your Arduino-compatible board.
- Run `arduino-cli board list` again.

### Upload fails because the port is busy

Close Arduino IDE Serial Monitor and any other application using the selected port, then retry.

### Serial permission is denied on Linux

Add your user to the group that owns the serial device, commonly `dialout`, then sign out and back in:

```bash
sudo usermod -a -G dialout "$USER"
```

### OpenAI generation fails

- Confirm that `OPENAI_API_KEY` is valid.
- Confirm that the account can access the selected model.
- Check the backend terminal for the returned error.
- Increase `OPENAI_TIMEOUT_MS` if the request is timing out.

### Compile times out on a cold Arduino build

The first Arduino CLI build can take longer while it resolves libraries and fills the build cache. Keep `COMPILE_TIMEOUT_MS=300000` in `.env` to allow up to five minutes, then retry the compile.

### The motors move in the wrong direction or hit too far

Disconnect servo power immediately. Check the linkage orientation and review `REST_ANGLE`, `STRIKE_ANGLE`, `SERVOMIN`, and `SERVOMAX` in the generated sketch before trying again. Mechanical installations vary even when the channel mapping is correct.

### A striker does not return to rest after a note

Do not upload the sketch until the generated code returns all motors to `REST_ANGLE` after every hit. The expected motion for every note is 0 degrees, 90 degrees, then back to 0 degrees before the next event.

## Security and generated files

- `.env`, `node_modules`, generated firmware, and compiled output are excluded from Git.
- API keys are not exposed by the settings endpoint.
- Arduino CLI is invoked without a shell.
- Requests and logs are bounded.
- Overlapping generate, compile, and upload operations are rejected.

Only run Aquatone on a trusted local machine and always inspect AI-generated firmware before uploading it to physical hardware.
