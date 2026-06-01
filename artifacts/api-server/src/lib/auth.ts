import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { logger } from "./logger.js";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-key-qap-local-dashboard";

export function signToken(payload: { email: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { email: string };
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
    return;
  }

  (req as any).admin = payload;
  next();
}
