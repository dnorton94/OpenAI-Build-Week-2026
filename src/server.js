import { createApp } from './app.js';
import { getConfig } from './config.js';

const { port } = getConfig();
const server = createApp().listen(port, () => {
  console.log(`Aquatone is ready at http://localhost:${port}`);
});

function shutdown(signal) {
  console.log(`\n${signal} received. Closing Aquatone...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
