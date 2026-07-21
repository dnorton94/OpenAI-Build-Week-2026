const $ = (selector) => document.querySelector(selector);
const elements = {
  prompt: $('#rhythmPrompt'), generate: $('#generateButton'), upload: $('#uploadButton'), editor: $('#codeEditor'),
  highlight: $('#codeHighlight code'), editorShell: $('#editorShell'), emptyEditor: $('#emptyEditor'), copy: $('#copyButton'),
  lineCount: $('#lineCount'), console: $('#console'), clearLogs: $('#clearLogs'), statusTitle: $('#statusTitle'),
  statusMessage: $('#statusMessage'), statusOrb: $('#statusOrb'), progress: $('#progressBar'), steps: $('#steps'),
  modal: $('#settingsModal'), settingsButton: $('#settingsButton'), closeSettings: $('#closeSettings'),
  cancelSettings: $('#cancelSettings'), settingsForm: $('#settingsForm'), toggleSecret: $('#toggleSecret'),
  keyStatus: $('#keyStatus'), deviceText: $('#deviceText'), toastRegion: $('#toastRegion')
};

let currentStatus = 'idle';
let hasFirmware = false;

const statusView = {
  idle: ['Ready when you are', 'idle', 0], generating: ['Arranging for C, E, and G', 'active', 12],
  ready: ['Ready to compile', 'success', 28], compiling: ['Compiling firmware', 'active', 48],
  compiled: ['Compilation complete', 'success', 65], uploading: ['Uploading to Arduino', 'active', 82],
  running: ['Aquatone is playing', 'success', 100], error: ['Something needs attention', 'error', 0]
};

const escapeHtml = (text) => text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);

function highlightArduino(source) {
  const tokens = [];
  const encodeIndex = (index) => {
    let value = index + 1;
    let encoded = '';
    while (value) { value -= 1; encoded = String.fromCharCode(65 + (value % 26)) + encoded; value = Math.floor(value / 26); }
    return encoded;
  };
  const stash = (html) => { tokens.push(html); return `\uE000${encodeIndex(tokens.length - 1)}\uE001`; };
  let code = escapeHtml(source);
  code = code.replace(/(&quot;|\")(.*?)(\1)/g, (m) => stash(`<span class="tok-string">${m}</span>`));
  code = code.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, (m) => stash(`<span class="tok-comment">${m}</span>`));
  code = code.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-number">$1</span>');
  code = code.replace(/\b(const|static|if|else|for|while|return|sizeof|true|false|HIGH|LOW|OUTPUT|PROGMEM)\b/g, '<span class="tok-keyword">$1</span>');
  code = code.replace(/\b(void|int|byte|bool|unsigned|long|uint8_t|uint16_t|Adafruit_PWMServoDriver)\b/g, '<span class="tok-type">$1</span>');
  code = code.replace(/\b(setup|loop|delay|millis|begin|setPWM|setPWMFreq|setServoAngle|playMelody|strikeNotes|restAll)\b(?=\s*\()/g, '<span class="tok-fn">$1</span>');
  code = code.replace(/\b([A-Z][A-Z0-9_]{2,})\b/g, '<span class="tok-constant">$1</span>');
  return code.replace(/\uE000([A-Z]+)\uE001/g, (_, encoded) => {
    let value = 0;
    for (const char of encoded) value = value * 26 + char.charCodeAt(0) - 64;
    return tokens[value - 1];
  });
}

function updateEditor() {
  const code = elements.editor.value;
  elements.highlight.innerHTML = highlightArduino(code) + '\n';
  elements.lineCount.textContent = code ? `${code.split('\n').length} lines` : '0 lines';
  hasFirmware = Boolean(code.trim());
  elements.editorShell.classList.toggle('empty', !hasFirmware);
  elements.copy.disabled = !hasFirmware;
  elements.upload.disabled = !hasFirmware || ['generating', 'compiling', 'uploading'].includes(currentStatus);
}

function setStatus(data) {
  currentStatus = data.status;
  const view = statusView[data.status] || statusView.idle;
  elements.statusTitle.textContent = view[0];
  elements.statusMessage.textContent = data.message || view[0];
  elements.statusOrb.className = `status-orb ${view[1]}`;
  elements.progress.style.width = `${view[2]}%`;
  elements.generate.disabled = Boolean(data.busy);
  elements.generate.classList.toggle('is-loading', data.status === 'generating');
  elements.upload.disabled = !hasFirmware || Boolean(data.busy);
  const order = ['generating', 'compiling', 'uploading', 'running'];
  const effective = { idle: -1, generating: 0, ready: 1, compiling: 1, compiled: 2, uploading: 2, running: 3, error: -1 }[data.status];
  [...elements.steps.children].forEach((step, index) => {
    step.classList.toggle('done', index < effective || (data.status === 'running' && index <= effective));
    step.classList.toggle('current', index === effective && data.status !== 'running');
  });
}

function addLog(entry) {
  elements.console.querySelector('.console-placeholder')?.remove();
  const line = document.createElement('div');
  line.className = `console-line ${entry.stream || ''}`;
  const time = new Date(entry.timestamp);
  line.innerHTML = `<time>${time.toLocaleTimeString([], { hour12: false })}</time><span></span>`;
  line.querySelector('span').textContent = entry.message;
  elements.console.append(line);
  elements.console.scrollTop = elements.console.scrollHeight;
}

function clearConsole() { elements.console.innerHTML = '<div class="console-placeholder">Waiting for an operation…</div>'; }

function toast(message, type = 'success') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  elements.toastRegion.append(node);
  setTimeout(() => node.remove(), 4500);
}

async function request(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function generate() {
  const prompt = elements.prompt.value.trim();
  if (prompt.length < 3) return toast('Describe a melody first.', 'error');
  try {
    const data = await request('/generate', { method: 'POST', body: JSON.stringify({ prompt }) });
    elements.editor.value = data.code;
    updateEditor();
    toast('Firmware generated — review it before flashing.');
  } catch (error) { toast(error.message, 'error'); }
}

async function compileAndUpload() {
  if (!hasFirmware) return;
  try {
    await request('/compile', { method: 'POST', body: JSON.stringify({ code: elements.editor.value }) });
    toast('Compilation successful. Uploading now…');
    await request('/upload', { method: 'POST', body: '{}' });
    toast('Upload complete — your three-glass melody is playing!');
  } catch (error) { toast(error.message, 'error'); }
}

function openSettings() { elements.modal.classList.add('open'); elements.modal.setAttribute('aria-hidden', 'false'); }
function closeSettings() { elements.modal.classList.remove('open'); elements.modal.setAttribute('aria-hidden', 'true'); }

async function loadSettings() {
  try {
    const settings = await request('/settings');
    for (const [key, value] of Object.entries(settings)) {
      if (key === 'hasOpenaiApiKey') continue;
      const input = elements.settingsForm.elements.namedItem(key);
      if (input) input.value = value;
    }
    elements.keyStatus.textContent = settings.hasOpenaiApiKey ? 'A key is configured on the server' : 'No key configured';
    elements.keyStatus.style.color = settings.hasOpenaiApiKey ? 'var(--aqua)' : '';
    elements.deviceText.textContent = `${settings.board.split(':').pop()?.toUpperCase() || settings.board} · ${settings.serialPort || 'Not configured'}`;
  } catch (error) { toast(error.message, 'error'); }
}

async function saveSettings(event) {
  event.preventDefault();
  const form = new FormData(elements.settingsForm);
  const body = Object.fromEntries(form.entries());
  for (const key of ['openaiTimeoutMs', 'compileTimeoutMs', 'uploadTimeoutMs']) body[key] = Number(body[key]);
  try {
    await request('/settings', { method: 'PUT', body: JSON.stringify(body) });
    elements.settingsForm.elements.openaiApiKey.value = '';
    await loadSettings(); closeSettings(); toast('Settings saved.');
  } catch (error) { toast(error.message, 'error'); }
}

elements.generate.addEventListener('click', generate);
elements.upload.addEventListener('click', compileAndUpload);
elements.prompt.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') generate(); });
document.querySelectorAll('[data-prompt]').forEach((button) => button.addEventListener('click', () => { elements.prompt.value = button.dataset.prompt; elements.prompt.focus(); }));
elements.editor.addEventListener('input', updateEditor);
elements.editor.addEventListener('scroll', () => { elements.highlight.parentElement.scrollTop = elements.editor.scrollTop; elements.highlight.parentElement.scrollLeft = elements.editor.scrollLeft; });
elements.editor.addEventListener('keydown', (event) => { if (event.key === 'Tab') { event.preventDefault(); const start = elements.editor.selectionStart; elements.editor.setRangeText('  ', start, elements.editor.selectionEnd, 'end'); updateEditor(); } });
elements.copy.addEventListener('click', async () => { await navigator.clipboard.writeText(elements.editor.value); toast('Firmware copied to clipboard.'); });
elements.clearLogs.addEventListener('click', clearConsole);
elements.settingsButton.addEventListener('click', openSettings);
elements.closeSettings.addEventListener('click', closeSettings);
elements.cancelSettings.addEventListener('click', closeSettings);
elements.modal.addEventListener('click', (event) => { if (event.target === elements.modal) closeSettings(); });
elements.settingsForm.addEventListener('submit', saveSettings);
elements.toggleSecret.addEventListener('click', () => { const input = elements.settingsForm.elements.openaiApiKey; input.type = input.type === 'password' ? 'text' : 'password'; elements.toggleSecret.textContent = input.type === 'password' ? 'Show' : 'Hide'; });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSettings(); });

const events = new EventSource('/events');
events.addEventListener('status', (event) => setStatus(JSON.parse(event.data)));
events.addEventListener('log', (event) => addLog(JSON.parse(event.data)));
events.addEventListener('clear', clearConsole);
events.onerror = () => { /* EventSource reconnects automatically. */ };

await loadSettings();
try { setStatus(await request('/status')); } catch { setStatus({ status: 'idle', message: 'Server connection unavailable' }); }
updateEditor();
