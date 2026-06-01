import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

function normalizeOrigin(value?: string | null) {
  return String(value || "").trim().replace(/\/$/, "");
}

function getAllowedOrigins() {
  const rawOrigins = [
    process.env.CLIENT_URL,
    process.env.ADMIN_DASHBOARD_URL,
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
    process.env.CORS_ORIGINS,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
    "https://workspaceadmin-dashboard-production-48e1.up.railway.app",
  ];

  return rawOrigins
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map(normalizeOrigin)
    .filter(Boolean);
}

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;

  const cleanOrigin = normalizeOrigin(origin);
  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.includes(cleanOrigin)) return true;

  // Allow Railway generated domains safely
  if (/^https:\/\/[a-z0-9-]+\.up\.railway\.app$/i.test(cleanOrigin)) {
    return true;
  }

  return false;
}

app.set("trust proxy", 1);

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

// Railway safe CORS handler
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (typeof origin === "string" && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
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
  res.setHeader("Access-Control-Max-Age", "86400");

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

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "api-server",
    message: "QuickApply Pro API is running",
    time: new Date().toISOString(),
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "api-server",
    status: "healthy",
    time: new Date().toISOString(),
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "api-server",
    status: "healthy",
    time: new Date().toISOString(),
  });
});

app.use("/api", router);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
  });
});

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error(
    {
      err,
      message: err?.message,
      stack: err?.stack,
      path: req.path,
      method: req.method,
      origin: req.headers.origin,
    },
    "Unhandled API error"
  );

  res.status(err?.status || 500).json({
    error: err?.message || "Internal server error",
  });
});

export default app;