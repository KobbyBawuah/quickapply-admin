import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:3000",
  "https://workspaceadmin-dashboard-production-48e1.up.railway.app",
]);

function getExtraAllowedOrigins() {
  return [
    process.env.CLIENT_URL,
    process.env.ADMIN_DASHBOARD_URL,
    process.env.FRONTEND_URL,
  ]
    .map((v) => String(v || "").trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function isRailwayAdminDashboardOrigin(origin: string) {
  return /^https:\/\/workspaceadmin-dashboard-production-[a-z0-9-]+\.up\.railway\.app$/i.test(origin);
}

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;

  const cleanOrigin = origin.trim().replace(/\/+$/, "");

  if (allowedOrigins.has(cleanOrigin)) return true;
  if (getExtraAllowedOrigins().includes(cleanOrigin)) return true;
  if (isRailwayAdminDashboardOrigin(cleanOrigin)) return true;

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
          origin: req.headers.origin,
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

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    logger.warn({ origin }, "Blocked by CORS");
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: "QuickApply Pro API Server",
    status: "online",
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", router);

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error?.({ err }, "Unhandled API error");

  const statusCode =
    typeof err?.status === "number"
      ? err.status
      : typeof err?.statusCode === "number"
        ? err.statusCode
        : 500;

  res.status(statusCode).json({
    success: false,
    error: err?.message || "Internal server error",
  });
});

export default app;