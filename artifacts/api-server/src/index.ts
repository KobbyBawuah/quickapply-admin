import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import app from "./app.js";
import { logger } from "./lib/logger.js";
import { connectMongoDB } from "./lib/mongodb.js";
import { seedTemplatesIfEmpty } from "./lib/seedTemplates.js";
import { startCronJobs } from "./lib/cronJobs.js";

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

async function main() {
  try {
    await connectMongoDB();
    await seedTemplatesIfEmpty();
    startCronJobs();

    logger.info("Startup initialization completed");
  } catch (err) {
    logger.error({ err }, "Startup initialization error (non-fatal)");
  }

  app.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});