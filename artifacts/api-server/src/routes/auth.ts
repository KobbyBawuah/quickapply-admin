import { Router } from "express";
import { signToken, requireAuth } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.post("/auth/login", (req, res) => {
  const { email, password } = req.body;
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@quickapplypro.com").trim();
  const adminPassword = (process.env.ADMIN_PASSWORD || "Admin@12345").trim();

  if (email !== adminEmail || password !== adminPassword) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid email or password" });
    return;
  }

  const token = signToken({ email });
  res.json({ token, admin: { email, name: "Admin" } });
});

router.post("/auth/logout", (_req, res) => {
  res.json({ message: "Logged out", success: true });
});

router.get("/auth/me", requireAuth, (req, res) => {
  const admin = (req as any).admin;
  res.json({ email: admin.email, name: "Admin" });
});

export default router;
