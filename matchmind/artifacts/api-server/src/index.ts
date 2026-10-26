import { readFileSync } from "node:fs";
import path from "node:path";
import app from "./app";
import { logger } from "./lib/logger";

// Load optional .env.local from the workspace root (never committed to the zip).
// Keys set in the real environment always win over file values.
const envFile = path.resolve(import.meta.dirname, "../../../.env.local");
try {
  for (const line of readFileSync(envFile, "utf-8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2];
    }
  }
  logger.info({ envFile }, "Loaded local environment file");
} catch {
  // No .env.local present - environment variables only. This is fine.
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
