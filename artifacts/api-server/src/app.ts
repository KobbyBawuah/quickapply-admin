import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors, { type CorsOptions } from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

function normalizeOrigin(value?: string | null): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getAllowedOrigins(): string[] {
  const rawOrigins = [
    process.env.CLIENT_URL,
    process.env.ADMIN_DASHBOARD_URL,
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
    process.env.CORS_ORIGINS,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
  ];

  return rawOrigins
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map(normalizeOrigin)
    .filter(Boolean);
}

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;

  const cleanOrigin = normalizeOrigin(origin);
  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.includes(cleanOrigin)) return true;

  return /^https:\/\/[a-z0-9-]+\.up\.railway\.app$/i.test(cleanOrigin);
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
  optionsSuccessStatus: 204,
};

app.set("trust proxy", 1);

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

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