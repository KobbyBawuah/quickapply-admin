import dns from "node:dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import app from "./app.js";
import { logger } from "./lib/logger.js";
import { connectMongoDB } from "./lib/mongodb.js";
import { seedTemplatesIfEmpty } from "./lib/seedTemplates.js";
import { startCronJobs } from "./lib/cronJobs.js";

const rawPort = process.env.PORT || "5000";
const port = Number(rawPort);
const host = process.env.HOST || "0.0.0.0";

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

  app.listen(port, host, () => {
    logger.info({ host, port }, "Server listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});