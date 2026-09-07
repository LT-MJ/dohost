import { existsSync } from "node:fs";
import path from "node:path";
import { getEnv } from "@hostpanel/shared/config";
import { createLogger } from "@hostpanel/shared/logger";
import { createBullBoardServer } from "./board";
import { startEmailWorker } from "./processors/email";

const envPath = path.resolve(import.meta.dirname, "../../../.env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const log = createLogger("worker");
const env = getEnv();

const emailWorker = startEmailWorker();
log.info({ env: env.NODE_ENV }, "email worker started");

const boardApp = createBullBoardServer();
const server = boardApp.listen(env.BULL_BOARD_PORT, () => {
  log.info({ port: env.BULL_BOARD_PORT }, "bull board listening");
});

async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, "shutting down worker");
  await emailWorker.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
