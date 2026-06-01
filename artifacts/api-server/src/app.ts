import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

function normalizeOrigin(value: string) {
  return String(value || "").trim().replace(/\/$/, "");
}

function getAllowedOrigins() {
  const fromEnv = [
    process.env.CLIENT_URL,
    process.env.ADMIN_DASHBOARD_URL,
    process.env.CORS_ORIGIN,
    process.env.CORS_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map(normalizeOrigin)
    .filter(Boolean);

  return new Set([
    ...fromEnv,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "https://workspaceadmin-dashboard-production-48e1.up.railway.app",
  ]);
}

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;

  const cleanOrigin = normalizeOrigin(origin);
  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.has(cleanOrigin)) return true;

  // Railway preview/production domains ke liye safe wildcard
  if (/^https:\/\/[a-z0-9-]+\.up\.railway\.app$/i.test(cleanOrigin)) {
    return true;
  }

  return false;
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

// Manual CORS preflight handler, Express 5 safe.
// Do NOT use app.options("*", ...) in Express 5.
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (typeof origin === "string" && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] ||
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
    ],
  })
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "api-server",
    time: new Date().toISOString(),
  });
});

app.use("/api", router);

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err }, "Unhandled API error");

  res.status(err?.status || 500).json({
    error: err?.message || "Internal server error",
  });
});

export default app;